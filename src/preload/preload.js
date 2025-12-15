const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer via window.cloudix
contextBridge.exposeInMainWorld('cloudix', {
    // Pterodactyl Login
    login: (apiKey) => ipcRenderer.invoke('pterodactyl-login', apiKey),
    logout: () => ipcRenderer.invoke('pterodactyl-logout'),
    checkLoginStatus: () => ipcRenderer.invoke('check-login-status'),
    getServers: () => ipcRenderer.invoke('get-pterodactyl-servers'),

    // User data
    getUserData: () => ipcRenderer.invoke('get-user-data'),
    saveUserData: (data) => ipcRenderer.invoke('save-user-data', data),

    // Quests
    getQuests: () => ipcRenderer.invoke('get-quests'),
    claimQuest: (questId) => ipcRenderer.invoke('claim-quest', questId),

    // Services
    getServices: () => ipcRenderer.invoke('get-services'),

    // Redemption (two-step process)
    validateRedeem: (serviceId) => ipcRenderer.invoke('validate-redeem', serviceId),
    confirmRedeem: (data) => ipcRenderer.invoke('confirm-redeem', data),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Pterodactyl Status
    getPterodactylStatus: () => ipcRenderer.invoke('get-pterodactyl-status'),

    // Utilities
    resetData: () => ipcRenderer.invoke('reset-data'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Admin Panel
    adminAddCoins: (data) => ipcRenderer.invoke('admin-add-coins', data),
    adminResetUser: (data) => ipcRenderer.invoke('admin-reset-user', data),
    adminResetAll: (data) => ipcRenderer.invoke('admin-reset-all', data),

    // Update System (electron-updater)
    updaterCheck: () => ipcRenderer.invoke('updater-check'),
    updaterDownload: () => ipcRenderer.invoke('updater-download'),
    updaterInstall: () => ipcRenderer.invoke('updater-install'),
    updaterGetVersion: () => ipcRenderer.invoke('updater-get-version'),

    // Update status listener
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (event, data) => callback(data));
    },

    // Discord Rich Presence
    updateDiscordPresence: (page, details) => ipcRenderer.invoke('update-discord-presence', page, details)
});

