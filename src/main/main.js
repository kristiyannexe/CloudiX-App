const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { registerHandlers } = require('./ipc-handlers');
const { autoUpdater } = require('electron-updater');
const logger = require('./logger');

let mainWindow = null;

// Auto-updater configuration
autoUpdater.autoDownload = true; // Auto-download updates
autoUpdater.autoInstallOnAppQuit = true; // Install when app closes

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'CloudiX App',
        icon: path.join(__dirname, '../../assets/icon.png'),
        backgroundColor: '#0f0f1a',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
        }
    });

    // Remove menu bar
    mainWindow.setMenuBarVisibility(false);

    // Load the app
    const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

    if (isDev) {
        // Development: load from Vite dev server
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        // Production: load from built files
        mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Log when window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ================================
// Auto Updater Events
// ================================
autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates...');
    sendUpdateStatus('checking');
});

autoUpdater.on('update-available', (info) => {
    logger.info('Update available:', info.version);
    sendUpdateStatus('available', { version: info.version, releaseNotes: info.releaseNotes });
});

autoUpdater.on('update-not-available', (info) => {
    logger.info('No update available');
    sendUpdateStatus('not-available', { version: info.version });
});

autoUpdater.on('download-progress', (progress) => {
    logger.info(`Download progress: ${progress.percent.toFixed(1)}%`);
    sendUpdateStatus('downloading', { percent: progress.percent });
});

autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded:', info.version);
    sendUpdateStatus('downloaded', { version: info.version });
});

autoUpdater.on('error', (error) => {
    logger.error('Update error:', error.message);
    sendUpdateStatus('error', { message: error.message });
});

function sendUpdateStatus(status, data = {}) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', { status, ...data });
    }
}

// Discord Webhook Logging
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1450198073493160087/gwFK0JqLTzzEcg8MYqc2xHqm1D85xiCsNcaMfwgOeKnCHyqtZtisv9tJ02iTh5l5Uxir';

function sendWebhookLog(username, email, action) {
    const https = require('https');
    const os = require('os');

    const embed = {
        title: `📱 CloudiX App - ${action}`,
        color: 0x7c3aed,
        fields: [
            { name: '👤 Потребител', value: username || 'Неизвестен', inline: true },
            { name: '📧 Email', value: email || 'Няма', inline: true },
            { name: '💻 Компютър', value: os.hostname(), inline: true },
            { name: '🖥️ Платформа', value: `${os.platform()} ${os.release()}`, inline: true }
        ],
        timestamp: new Date().toISOString()
    };

    const data = JSON.stringify({ embeds: [embed] });

    const url = new URL(WEBHOOK_URL);
    const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const req = https.request(options);
    req.on('error', () => { }); // Ignore errors silently
    req.write(data);
    req.end();
}

// ================================
// Update IPC Handlers
// ================================
ipcMain.handle('updater-check', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
        logger.error('Update check error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('updater-download', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        logger.error('Download error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('updater-install', () => {
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
});

ipcMain.handle('updater-get-version', () => {
    return { success: true, version: app.getVersion() };
});

// Initialize app
app.whenReady().then(() => {
    // Register IPC handlers before creating window
    registerHandlers();

    // Create the main window
    createWindow();

    // Log app open to Discord
    const Store = require('electron-store');
    const userStore = new Store({ name: 'user-data' });
    const username = userStore.get('username', 'Нов потребител');
    const email = userStore.get('email', '');
    sendWebhookLog(username, email, 'Отвори приложението');

    // Auto-update: Check for updates on startup (production only)
    if (app.isPackaged) {
        setTimeout(() => {
            logger.info('Checking for updates on startup...');
            autoUpdater.checkForUpdates().catch(err => {
                logger.error('Auto-update check failed:', err.message);
            });
        }, 3000); // Wait 3 seconds after startup

        // Check for updates every hour
        setInterval(() => {
            autoUpdater.checkForUpdates().catch(() => { });
        }, 60 * 60 * 1000);
    }

    // macOS: re-create window when dock icon is clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Security: prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    // Prevent navigation to external URLs
    contents.on('will-navigate', (event, url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin !== 'http://localhost:5173' && !url.startsWith('file://')) {
            event.preventDefault();
        }
    });
});
