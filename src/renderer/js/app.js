/**
 * CloudiX App - Renderer JavaScript
 * Handles UI interactions and communicates with main process via IPC
 */

// ================================
// State Management
// ================================
let appState = {
    currentPage: 'dashboard',
    userData: null,
    settings: null,
    quests: [],
    services: [],
    servers: [],
    isLoggedIn: false,
    pendingRedeem: null
};

// ================================
// DOM Elements
// ================================
const elements = {
    // Login
    loginScreen: document.getElementById('login-screen'),
    appContainer: document.getElementById('app-container'),
    apiKeyInput: document.getElementById('api-key-input'),
    loginBtn: document.getElementById('login-btn'),
    loginError: document.getElementById('login-error'),
    registerLink: document.getElementById('register-link'),

    // Sidebar
    navItems: document.querySelectorAll('.nav-item'),
    pages: document.querySelectorAll('.page'),
    sidebarCoins: document.getElementById('sidebar-coins'),
    sidebarUsername: document.getElementById('sidebar-username'),
    adminBadge: document.getElementById('admin-badge'),
    logoutBtn: document.getElementById('logout-btn'),

    // Dashboard
    usernameInput: document.getElementById('username-input'),
    emailInput: document.getElementById('email-input'),
    saveProfileBtn: document.getElementById('save-profile'),
    dashboardCoins: document.getElementById('dashboard-coins'),
    openTicketsBtn: document.getElementById('open-tickets'),

    // Servers
    serversContainer: document.getElementById('servers-container'),

    // Quests
    questsContainer: document.getElementById('quests-container'),

    // Redeem
    servicesContainer: document.getElementById('services-container'),
    alreadyRedeemed: document.getElementById('already-redeemed'),
    redeemedServiceName: document.getElementById('redeemed-service-name'),

    // Settings
    themeBtns: document.querySelectorAll('.theme-btn'),
    resetDataBtn: document.getElementById('reset-data-btn'),

    // Modal
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalBody: document.getElementById('modal-body'),
    modalCancel: document.getElementById('modal-cancel'),
    modalConfirm: document.getElementById('modal-confirm'),

    // Admin Panel
    adminNav: document.getElementById('admin-nav'),
    adminUserEmail: document.getElementById('admin-user-email'),
    adminCoinsAmount: document.getElementById('admin-coins-amount'),
    adminAddCoins: document.getElementById('admin-add-coins'),
    adminResetEmail: document.getElementById('admin-reset-email'),
    adminResetUser: document.getElementById('admin-reset-user'),
    adminResetAll: document.getElementById('admin-reset-all'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ================================
// Initialization
// ================================
async function init() {
    try {
        // KILL SWITCH - App expires on 31.12.2025
        const EXPIRY_DATE = new Date('2025-12-31T23:59:00');
        const now = new Date();

        if (now > EXPIRY_DATE) {
            showExpiredScreen();
            return;
        }

        // Check login status first
        const loginStatus = await window.cloudix.checkLoginStatus();

        if (loginStatus.isLoggedIn) {
            appState.isLoggedIn = true;
            appState.userData = loginStatus.user;
            showApp();
            await loadAppData();
        } else {
            showLogin();
        }

        setupLogin();
        setupNavigation();
        setupDashboard();
        setupSettings();
        setupModal();
        setupAdmin();

        const settings = await window.cloudix.getSettings();
        appState.settings = settings;
        applyTheme(settings?.theme || 'dark');

        // Check for updates
        checkForUpdates();

        console.log('CloudiX App initialized');
    } catch (error) {
        console.error('Initialization error:', error);
        showLogin();
    }
}

// ================================
// Update System (electron-updater)
// ================================
let updateState = {
    checking: false,
    downloading: false,
    downloaded: false,
    percent: 0,
    newVersion: null
};

async function checkForUpdates() {
    try {
        // Setup update status listener
        window.cloudix.onUpdateStatus(handleUpdateStatus);

        // Check for updates
        const result = await window.cloudix.updaterCheck();
        if (result.success && result.updateInfo) {
            console.log('Update info:', result.updateInfo);
        }
    } catch (error) {
        console.error('Update check error:', error);
    }
}

function handleUpdateStatus(data) {
    console.log('Update status:', data);

    switch (data.status) {
        case 'checking':
            updateState.checking = true;
            break;

        case 'available':
            updateState.checking = false;
            updateState.newVersion = data.version;
            showUpdateBanner(data.version);
            break;

        case 'not-available':
            updateState.checking = false;
            break;

        case 'downloading':
            updateState.downloading = true;
            updateState.percent = data.percent;
            updateDownloadProgress(data.percent);
            break;

        case 'downloaded':
            updateState.downloading = false;
            updateState.downloaded = true;
            showInstallBanner(data.version);
            break;

        case 'error':
            updateState.checking = false;
            updateState.downloading = false;
            showToast('Грешка при обновяване: ' + data.message, 'error');
            break;
    }
}

function showUpdateBanner(newVersion) {
    // Remove existing banner if any
    const existingBanner = document.querySelector('.update-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.id = 'update-banner';
    banner.innerHTML = `
        <div class="update-content">
            <span class="update-icon">🚀</span>
            <span class="update-text">Налична е нова версия <strong>v${newVersion}</strong>!</span>
            <button class="update-btn" id="update-download-btn" onclick="downloadUpdate()">Изтегли обновление</button>
            <button class="update-close" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
        <div class="update-progress hidden" id="update-progress">
            <div class="update-progress-bar" id="update-progress-bar"></div>
            <span class="update-progress-text" id="update-progress-text">0%</span>
        </div>
    `;
    document.body.prepend(banner);
}

function showInstallBanner(version) {
    const banner = document.getElementById('update-banner');
    if (banner) {
        banner.innerHTML = `
            <div class="update-content">
                <span class="update-icon">✅</span>
                <span class="update-text">Версия <strong>v${version}</strong> е готова!</span>
                <button class="update-btn update-install-btn" onclick="installUpdate()">Рестартирай и инсталирай</button>
            </div>
        `;
    }
}

function updateDownloadProgress(percent) {
    const progressContainer = document.getElementById('update-progress');
    const progressBar = document.getElementById('update-progress-bar');
    const progressText = document.getElementById('update-progress-text');
    const downloadBtn = document.getElementById('update-download-btn');

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent.toFixed(0)}%`;
    if (downloadBtn) downloadBtn.textContent = 'Изтегляне...';
    if (downloadBtn) downloadBtn.disabled = true;
}

async function downloadUpdate() {
    try {
        showToast('Изтеглянето започна...', 'info');
        await window.cloudix.updaterDownload();
    } catch (error) {
        console.error('Download error:', error);
        showToast('Грешка при изтегляне', 'error');
    }
}

async function installUpdate() {
    showToast('Приложението ще се рестартира...', 'info');
    setTimeout(async () => {
        await window.cloudix.updaterInstall();
    }, 1000);
}

async function loadAppData() {
    await Promise.all([
        loadUserData(),
        loadQuests(),
        loadServices(),
        loadServers()
    ]);
    showToast('Добре дошъл, ' + (appState.userData?.username || 'User') + '! 🎉', 'success');
}

// ================================
// Login System
// ================================
function showExpiredScreen() {
    // Hide everything and show expired message
    elements.loginScreen?.classList.add('hidden');
    elements.appContainer?.classList.add('hidden');

    // Create expired overlay
    const expiredDiv = document.createElement('div');
    expiredDiv.className = 'expired-screen';
    expiredDiv.innerHTML = `
        <div class="expired-container">
            <span class="expired-icon">⏰</span>
            <h1>Приложението е изтекло</h1>
            <p>CloudiX App е валидно до 31.12.2025</p>
            <p>Моля свържете се с нас за нова версия.</p>
            <a href="https://discord.gg/Bv2Q6z9T" class="btn btn-primary">💬 Discord</a>
        </div>
    `;
    document.body.appendChild(expiredDiv);
}

function showLogin() {
    elements.loginScreen?.classList.remove('hidden');
    elements.appContainer?.classList.add('hidden');
}

function showApp() {
    elements.loginScreen?.classList.add('hidden');
    elements.appContainer?.classList.remove('hidden');
    updateSidebarUser();
}

function setupLogin() {
    elements.loginBtn?.addEventListener('click', handleLogin);
    elements.apiKeyInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    elements.logoutBtn?.addEventListener('click', handleLogout);
    elements.registerLink?.addEventListener('click', (e) => {
        e.preventDefault();
        window.cloudix.openExternal('https://panel.cloudixhosting.site');
    });
}

async function handleLogin() {
    const apiKey = elements.apiKeyInput?.value.trim();

    if (!apiKey) {
        showLoginError('Моля въведи API ключ');
        return;
    }

    elements.loginBtn.disabled = true;
    elements.loginBtn.textContent = '⏳ Влизане...';
    hideLoginError();

    try {
        const result = await window.cloudix.login(apiKey);

        if (result.success) {
            appState.isLoggedIn = true;
            appState.userData = result.user;
            appState.servers = result.servers;
            showApp();
            await loadAppData();
        } else {
            showLoginError(result.error || 'Грешка при вход');
        }
    } catch (error) {
        showLoginError('Грешка: ' + error.message);
    }

    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = '🔐 Вход';
}

async function handleLogout() {
    await window.cloudix.logout();
    appState.isLoggedIn = false;
    appState.userData = null;
    appState.servers = [];
    elements.apiKeyInput.value = '';
    showLogin();
    showToast('Излезе успешно', 'info');
}

function showLoginError(message) {
    if (elements.loginError) {
        elements.loginError.textContent = message;
        elements.loginError.classList.remove('hidden');
    }
}

function hideLoginError() {
    elements.loginError?.classList.add('hidden');
}

function updateSidebarUser() {
    if (elements.sidebarUsername) {
        elements.sidebarUsername.textContent = appState.userData?.username || 'User';
    }
    if (elements.adminBadge) {
        if (appState.userData?.isAdmin) {
            elements.adminBadge.classList.remove('hidden');
        } else {
            elements.adminBadge.classList.add('hidden');
        }
    }
    // Show admin nav for admins
    if (elements.adminNav) {
        if (appState.userData?.isAdmin) {
            elements.adminNav.classList.remove('hidden');
        } else {
            elements.adminNav.classList.add('hidden');
        }
    }
}

// ================================
// Admin Panel
// ================================
function setupAdmin() {
    // Add Coins
    elements.adminAddCoins?.addEventListener('click', async () => {
        const email = elements.adminUserEmail?.value.trim();
        const amount = parseInt(elements.adminCoinsAmount?.value);

        if (!email || !amount || amount < 1) {
            showToast('Въведи email и брой монети', 'warning');
            return;
        }

        const result = await window.cloudix.adminAddCoins({ email, amount });
        if (result.success) {
            showToast(result.message, 'success');
            if (result.newBalance !== undefined) {
                appState.userData.coins = result.newBalance;
                updateCoinsDisplay();
            }
            elements.adminUserEmail.value = '';
            elements.adminCoinsAmount.value = '';
        } else {
            showToast(result.error, 'error');
        }
    });

    // Reset Redemption
    elements.adminResetUser?.addEventListener('click', async () => {
        const email = elements.adminResetEmail?.value.trim();
        if (!email) {
            showToast('Въведи email', 'warning');
            return;
        }

        const result = await window.cloudix.adminResetUser({ email });
        if (result.success) {
            showToast(result.message, 'success');
            loadUserData();
        } else {
            showToast(result.error, 'error');
        }
    });

    // Reset All
    elements.adminResetAll?.addEventListener('click', async () => {
        const email = elements.adminResetEmail?.value.trim();
        if (!email) {
            showToast('Въведи email', 'warning');
            return;
        }

        const result = await window.cloudix.adminResetAll({ email });
        if (result.success) {
            showToast(result.message, 'success');
            loadUserData();
            loadQuests();
        } else {
            showToast(result.error, 'error');
        }
    });
}

// ================================
// Data Loading
// ================================
async function loadUserData() {
    const data = await window.cloudix.getUserData();
    appState.userData = { ...appState.userData, ...data };
    updateCoinsDisplay();

    if (elements.usernameInput && appState.userData.username) {
        elements.usernameInput.value = appState.userData.username;
    }
    if (elements.emailInput && appState.userData.email) {
        elements.emailInput.value = appState.userData.email;
    }

    updateRedeemState();
}

async function loadQuests() {
    appState.quests = await window.cloudix.getQuests();
    renderQuests();
}

async function loadServices() {
    appState.services = await window.cloudix.getServices();
    renderServices();
}

async function loadServers() {
    try {
        const result = await window.cloudix.getServers();
        if (result.success) {
            appState.servers = result.servers;
            renderServers();
        }
    } catch (error) {
        console.error('Failed to load servers:', error);
    }
}

// ================================
// Navigation
// ================================
function setupNavigation() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(pageName) {
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    elements.pages.forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });

    appState.currentPage = pageName;

    // Update Discord Rich Presence
    if (window.cloudix && window.cloudix.updateDiscordPresence) {
        window.cloudix.updateDiscordPresence(pageName);
    }

    if (pageName === 'servers') {
        loadServers();
    } else if (pageName === 'redeem') {
        loadUserData().then(() => renderServices());
    } else if (pageName === 'quests') {
        loadQuests();
    }
}

// ================================
// Servers Page
// ================================
function renderServers() {
    if (!elements.serversContainer) return;

    if (appState.servers.length === 0) {
        elements.serversContainer.innerHTML = `
      <div class="no-servers">
        <span class="no-servers-icon">🖥️</span>
        <h3>Няма сървъри</h3>
        <p>Все още нямаш създадени сървъри. Отиди на Redeem за да вземеш безплатен!</p>
      </div>
    `;
        return;
    }

    elements.serversContainer.innerHTML = appState.servers.map(server => `
    <div class="server-card">
      <div class="server-header">
        <span class="server-name">${server.name}</span>
        <span class="server-status ${getStatusClass(server.status)}">${getStatusText(server.status)}</span>
      </div>
      <div class="server-info">
        <div class="server-info-item">
          <span>ID:</span>
          <strong>${server.id}</strong>
        </div>
        <div class="server-info-item">
          <span>Node:</span>
          <strong>${server.node || 'N/A'}</strong>
        </div>
        ${server.limits ? `
        <div class="server-info-item">
          <span>RAM:</span>
          <strong>${server.limits.memory} MB</strong>
        </div>
        <div class="server-info-item">
          <span>Disk:</span>
          <strong>${server.limits.disk} MB</strong>
        </div>
        ` : ''}
      </div>
      <div class="server-actions">
        <button class="btn btn-primary btn-small" onclick="window.cloudix.openExternal('https://panel.cloudixhosting.site/server/${server.id}')">
          🔗 Open Panel
        </button>
      </div>
    </div>
  `).join('');
}

function getStatusClass(status) {
    if (status === 'running') return 'online';
    if (status === 'starting') return 'starting';
    return 'offline';
}

function getStatusText(status) {
    if (status === 'running') return '🟢 Online';
    if (status === 'starting') return '🟡 Starting';
    if (status === 'stopping') return '🟡 Stopping';
    return '🔴 Offline';
}

// ================================
// Dashboard
// ================================
function setupDashboard() {
    elements.saveProfileBtn?.addEventListener('click', async () => {
        const username = elements.usernameInput?.value.trim();
        const email = elements.emailInput?.value.trim();

        if (!username) {
            showToast('Моля въведи потребителско име', 'warning');
            return;
        }

        const result = await window.cloudix.saveUserData({ username, email });

        if (result.success) {
            appState.userData.username = username;
            appState.userData.email = email;
            showToast('Профилът е запазен! ✅', 'success');
        } else {
            showToast(result.error || 'Грешка при запазване', 'error');
        }
    });

    elements.openTicketsBtn?.addEventListener('click', async () => {
        showToast('Отваряне на Discord...', 'info');
        await window.cloudix.openExternal('https://discord.gg/Bv2Q6z9T');
    });
}

// ================================
// Coins Display
// ================================
function updateCoinsDisplay() {
    const coins = appState.userData?.coins || 0;

    if (elements.sidebarCoins) {
        elements.sidebarCoins.textContent = coins;
    }

    if (elements.dashboardCoins) {
        elements.dashboardCoins.textContent = coins;
    }
}

// ================================
// Quests
// ================================
function renderQuests() {
    if (!elements.questsContainer) return;

    elements.questsContainer.innerHTML = appState.quests.map(quest => `
    <div class="quest-card" data-quest-id="${quest.id}">
      <div class="quest-icon">${quest.icon}</div>
      <div class="quest-info">
        <h4 class="quest-title">${quest.title}</h4>
        <p class="quest-description">${quest.description}</p>
        <div class="quest-footer">
          <div class="quest-reward">
            <span>🪙</span>
            <span>+${quest.coins}</span>
          </div>
          <span class="quest-info-text">📩 Админ добавя</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function claimQuest(questId) {
    const result = await window.cloudix.claimQuest(questId);

    if (result.success) {
        appState.userData.coins = result.newBalance;
        updateCoinsDisplay();
        const quest = appState.quests.find(q => q.id === questId);
        if (quest) quest.canClaim = false;
        renderQuests();
        showToast(`🎉 +${result.coinsEarned} монети!`, 'success');
    } else {
        showToast(result.error || 'Грешка', 'error');
        renderQuests();
    }
}

// ================================
// Services (Redeem)
// ================================
function renderServices() {
    if (!elements.servicesContainer) return;

    const hasRedeemed = appState.userData?.hasRedeemed;
    const currentCoins = appState.userData?.coins || 0;

    elements.servicesContainer.innerHTML = appState.services.map(service => {
        const canAfford = currentCoins >= service.cost;
        const isDisabled = hasRedeemed;

        return `
      <div class="service-card ${isDisabled ? 'disabled' : ''}" data-service-id="${service.id}">
        <h3 class="service-name">${service.name}</h3>
        <div class="service-cost">
          <span>🪙</span>
          <span>${service.cost}</span>
        </div>
        <div class="your-coins">Твоите: <strong>${currentCoins}</strong></div>
        <ul class="service-features">
          ${service.features.map(f => `<li>✓ ${f}</li>`).join('')}
        </ul>
        <button 
          class="btn ${canAfford && !hasRedeemed ? 'btn-primary' : 'btn-secondary'} redeem-btn" 
          data-service-id="${service.id}"
          ${isDisabled || !canAfford ? 'disabled' : ''}
        >
          ${hasRedeemed ? '✅ Използвано' : (!canAfford ? `❌ Нужни: ${service.cost}` : '🎁 Вземи!')}
        </button>
      </div>
    `;
    }).join('');

    document.querySelectorAll('.redeem-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const serviceId = btn.dataset.serviceId;

            if (!appState.userData.email) {
                showToast('⚠️ Първо въведи email в Dashboard!', 'warning');
                navigateTo('dashboard');
                return;
            }

            btn.disabled = true;
            btn.textContent = '⏳ Зареждане...';
            await startRedemption(serviceId);
            btn.disabled = false;
            btn.textContent = '🎁 Вземи!';
        });
    });
}

async function startRedemption(serviceId) {
    showToast('⏳ Проверка...', 'info');

    const result = await window.cloudix.validateRedeem(serviceId);

    if (!result.success) {
        showToast(result.error || 'Грешка', 'error');
        return;
    }

    appState.pendingRedeem = {
        serviceId: serviceId,
        service: result.service,
        pterodactylUserId: result.pterodactylUserId,
        eggConfig: result.eggConfig
    };

    showEggVariablesForm(result.service, result.eggConfig);
}

function showEggVariablesForm(service, eggConfig) {
    const formHtml = `
    <div class="egg-form">
      <div class="egg-form-header">
        <h3>🖥️ ${service.name}</h3>
        <p>Конфигурирай сървъра</p>
      </div>
      
      <div class="egg-form-group">
        <label for="server-name">Име на сървъра</label>
        <input type="text" id="server-name" placeholder="FiveM Server" value="FiveM-Server" maxlength="50">
      </div>

      <div class="egg-form-group">
        <label for="license-key">FiveM License Key <span class="required">*</span></label>
        <input type="text" id="license-key" data-env="FIVEM_LICENSE" placeholder="cfxk_xxx" required>
        <small class="form-hint"><a href="https://keymaster.fivem.net" target="_blank">keymaster.fivem.net</a></small>
      </div>

      <div class="egg-form-info">
        <p>✅ FiveM: <strong>Build 23683</strong></p>
        <p>✅ txAdmin: <strong>Включен</strong></p>
        <p>✅ Портове: <strong>Авто</strong></p>
      </div>
    </div>
  `;

    showFormModal('🎮 FiveM Сървър', formHtml, confirmRedemption);
}

async function confirmRedemption() {
    if (!appState.pendingRedeem) {
        showToast('Грешка', 'error');
        return;
    }

    const pendingData = { ...appState.pendingRedeem };
    const serverName = document.getElementById('server-name')?.value || `FiveM-${Date.now()}`;

    const environment = {};
    document.querySelectorAll('[data-env]').forEach(input => {
        environment[input.dataset.env] = input.value;
    });

    elements.modalOverlay?.classList.add('hidden');
    showToast('⏳ Създаване на сървър...', 'info');

    try {
        const result = await window.cloudix.confirmRedeem({
            serviceId: pendingData.serviceId,
            serverName: serverName,
            environment: environment
        });

        appState.pendingRedeem = null;

        if (result.success) {
            appState.userData.coins = result.newBalance;
            appState.userData.hasRedeemed = true;
            updateCoinsDisplay();
            updateRedeemState();
            renderServices();
            loadServers();
            showToast(`🎉 ${result.message}`, 'success');
        } else {
            showToast(result.error || 'Грешка', 'error');
        }
    } catch (error) {
        appState.pendingRedeem = null;
        showToast(`❌ ${error.message}`, 'error');
    }
}

function updateRedeemState() {
    if (!elements.alreadyRedeemed) return;

    if (appState.userData?.hasRedeemed) {
        elements.alreadyRedeemed.classList.remove('hidden');
        if (elements.redeemedServiceName) {
            elements.redeemedServiceName.textContent = appState.userData.redeemedService || 'Unknown';
        }
    } else {
        elements.alreadyRedeemed.classList.add('hidden');
    }
}

// ================================
// Settings
// ================================
function setupSettings() {
    elements.themeBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const theme = btn.dataset.theme;
            await changeTheme(theme);
        });
    });

    elements.resetDataBtn?.addEventListener('click', () => {
        showModal('⚠️ Изчистване', 'Сигурен ли си? Ще изгубиш всички данни!', async () => {
            await resetData();
        });
    });
}

async function changeTheme(theme) {
    const result = await window.cloudix.saveSettings({ theme });
    if (result.success) {
        appState.settings.theme = theme;
        applyTheme(theme);
        showToast(`Тема: ${theme === 'dark' ? 'тъмна' : 'светла'}`, 'success');
    }
}

function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    elements.themeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

async function resetData() {
    const result = await window.cloudix.resetData();
    if (result.success) {
        showToast('Данните са изчистени', 'success');
        await loadAppData();
        navigateTo('dashboard');
    }
}

// ================================
// Modal
// ================================
let modalCallback = null;

function setupModal() {
    elements.modalCancel?.addEventListener('click', hideModal);
    elements.modalConfirm?.addEventListener('click', () => {
        if (modalCallback) modalCallback();
        hideModal();
    });
    elements.modalOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) hideModal();
    });
}

function showModal(title, message, onConfirm) {
    if (elements.modalTitle) elements.modalTitle.textContent = title;
    if (elements.modalMessage) elements.modalMessage.textContent = message;
    if (elements.modalBody) elements.modalBody.innerHTML = '';
    modalCallback = onConfirm;
    elements.modalOverlay?.classList.remove('hidden');
}

function showFormModal(title, formHtml, onConfirm) {
    if (elements.modalTitle) elements.modalTitle.textContent = title;
    if (elements.modalMessage) elements.modalMessage.textContent = '';
    if (elements.modalBody) elements.modalBody.innerHTML = formHtml;
    modalCallback = onConfirm;
    elements.modalOverlay?.classList.remove('hidden');
    if (elements.modalConfirm) {
        elements.modalConfirm.textContent = '🚀 Създай';
        elements.modalConfirm.className = 'btn btn-success';
    }
}

function hideModal() {
    elements.modalOverlay?.classList.add('hidden');
    modalCallback = null;
    appState.pendingRedeem = null;
    if (elements.modalConfirm) {
        elements.modalConfirm.textContent = 'Потвърди';
        elements.modalConfirm.className = 'btn btn-danger';
    }
}

// ================================
// Toast
// ================================
function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
    elements.toastContainer?.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ================================
// Start
// ================================
document.addEventListener('DOMContentLoaded', init);
