const { ipcMain, shell } = require('electron');
const Store = require('electron-store');
const https = require('https');
const http = require('http');
const logger = require('./logger');

// Initialize stores
const userStore = new Store({ name: 'user-data' });
const settingsStore = new Store({ name: 'settings' });

// Pterodactyl Configuration - UPDATE THESE VALUES
const PTERODACTYL_CONFIG = {
    panelUrl: 'https://panel.cloudixhosting.site', // Your Pterodactyl panel URL
    apiKey: 'ptla_O46Xi5PGrKRU7kwd3UNmBQ6E6b7oZUMqXgXFWZrZnJC',       // Your Admin API key
    locationId: 1,                                  // Location ID for server creation
    nodeId: 1,                                      // Node ID for allocation creation
    nestId: 5,                                      // Nest ID (e.g., 1 for Minecraft)
    eggId: 15                                       // Egg ID for the server type
};

// Default quest definitions - Discord invite based
const QUESTS = [
    { id: 'invite_1', title: '1 Invite', description: 'Покани 1 човек в Discord', coins: 5, icon: '👤' },
    { id: 'invite_2', title: '2 Invites', description: 'Покани 2 човека в Discord', coins: 10, icon: '👥' },
    { id: 'invite_5', title: '5 Invites', description: 'Покани 5 човека в Discord', coins: 25, icon: '🎉' },
    { id: 'invite_10', title: '10 Invites', description: 'Покани 10 човека в Discord', coins: 50, icon: '🔥' },
    { id: 'invite_25', title: '25 Invites', description: 'Покани 25 човека в Discord', coins: 100, icon: '⭐' },
    { id: 'invite_50', title: '50 Invites', description: 'Покани 50 човека в Discord', coins: 200, icon: '💎' }
];

// FiveM Hosting services with Pterodactyl specs
const SERVICES = [
    {
        id: 'fivem_basic',
        name: 'FiveM Basic',
        cost: 50,
        features: ['1 GB RAM', '5 GB SSD', 'FiveM Server', 'txAdmin Panel'],
        pterodactyl: {
            memory: 1024,      // 1 GB RAM
            disk: 5120,        // 5 GB
            cpu: 100,          // 100% CPU
            databases: 1,
            backups: 1
        }
    },
    {
        id: 'fivem_standard',
        name: 'FiveM Standard',
        cost: 100,
        features: ['2 GB RAM', '10 GB SSD', 'FiveM Server', 'txAdmin Panel', 'Приоритетна поддръжка'],
        pterodactyl: {
            memory: 2048,      // 2 GB RAM
            disk: 10240,       // 10 GB
            cpu: 150,          // 150% CPU
            databases: 2,
            backups: 2
        }
    },
    {
        id: 'fivem_premium',
        name: 'FiveM Premium',
        cost: 150,
        features: ['3 GB RAM', '15 GB SSD', 'FiveM Server', 'txAdmin Panel', 'Приоритетна поддръжка', 'DDoS Защита'],
        pterodactyl: {
            memory: 3072,      // 3 GB RAM
            disk: 15360,       // 15 GB
            cpu: 200,          // 200% CPU
            databases: 3,
            backups: 3
        }
    }
];

// Initialize default user data if not exists
function initializeUserData() {
    if (!userStore.has('username')) {
        const defaultData = {
            username: 'CloudiX User',
            email: '',
            coins: 0,
            hasRedeemed: false,
            redeemedService: null,
            pterodactylUserId: null,
            pterodactylServerId: null,
            quests: {}
        };

        QUESTS.forEach(quest => {
            defaultData.quests[quest.id] = { lastClaimed: null };
        });

        Object.entries(defaultData).forEach(([key, value]) => {
            userStore.set(key, value);
        });

        logger.info('Initialized default user data');
    }
}

// Initialize default settings if not exists
function initializeSettings() {
    if (!settingsStore.has('theme')) {
        settingsStore.set('theme', 'dark');
        logger.info('Initialized default settings');
    }
}

// Check if quest can be claimed (once per day)
function canClaimQuest(questId) {
    const quests = userStore.get('quests', {});
    const questData = quests[questId];

    if (!questData || !questData.lastClaimed) {
        return true;
    }

    const lastClaim = new Date(questData.lastClaimed);
    const now = new Date();

    // Reset at midnight
    const lastClaimDay = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return today > lastClaimDay;
}

// ================================
// Pterodactyl API Functions
// ================================

/**
 * Make API request to Pterodactyl panel (Admin API)
 */
function pterodactylRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, PTERODACTYL_CONFIG.panelUrl);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Authorization': `Bearer ${PTERODACTYL_CONFIG.apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        const req = httpModule.request(options, (res) => {
            let body = '';

            res.on('data', chunk => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const response = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(response);
                    } else {
                        logger.error(`Pterodactyl API Error: ${res.statusCode} - ${body}`);
                        reject(new Error(response.errors?.[0]?.detail || `API Error: ${res.statusCode}`));
                    }
                } catch (e) {
                    reject(new Error('Failed to parse API response'));
                }
            });
        });

        req.on('error', (e) => {
            logger.error(`Pterodactyl request error: ${e.message}`);
            reject(e);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Make API request to Pterodactyl panel (Client API - with user's API key)
 */
function pterodactylClientRequest(method, endpoint, clientApiKey) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, PTERODACTYL_CONFIG.panelUrl);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Authorization': `Bearer ${clientApiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        const req = httpModule.request(options, (res) => {
            let body = '';

            res.on('data', chunk => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const response = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(response);
                    } else {
                        logger.error(`Pterodactyl Client API Error: ${res.statusCode}`);
                        reject(new Error(response.errors?.[0]?.detail || `API Error: ${res.statusCode}`));
                    }
                } catch (e) {
                    reject(new Error('Failed to parse API response'));
                }
            });
        });

        req.on('error', (e) => {
            logger.error(`Pterodactyl client request error: ${e.message}`);
            reject(e);
        });

        req.end();
    });
}

/**
 * Find Pterodactyl user by email (does NOT create new users)
 * Returns user ID if found, null if not found
 */
async function findPterodactylUser(email) {
    try {
        // Try to find existing user by email
        const usersResponse = await pterodactylRequest('GET', `/api/application/users?filter[email]=${encodeURIComponent(email)}`);

        if (usersResponse.data && usersResponse.data.length > 0) {
            logger.info(`Found existing Pterodactyl user: ${email}`);
            return {
                id: usersResponse.data[0].attributes.id,
                username: usersResponse.data[0].attributes.username
            };
        }

        // User not found
        logger.warn(`Pterodactyl user not found: ${email}`);
        return null;
    } catch (error) {
        logger.error(`Failed to find Pterodactyl user: ${error.message}`);
        throw error;
    }
}

/**
 * Get egg variables from Pterodactyl
 */
async function getEggVariables(nestId, eggId) {
    try {
        const response = await pterodactylRequest('GET', `/api/application/nests/${nestId}/eggs/${eggId}?include=variables`);

        if (response.attributes && response.attributes.relationships && response.attributes.relationships.variables) {
            const variables = response.attributes.relationships.variables.data.map(v => ({
                name: v.attributes.name,
                description: v.attributes.description,
                env_variable: v.attributes.env_variable,
                default_value: v.attributes.default_value,
                user_viewable: v.attributes.user_viewable,
                user_editable: v.attributes.user_editable,
                rules: v.attributes.rules
            }));

            logger.info(`Fetched ${variables.length} egg variables for nest ${nestId}, egg ${eggId}`);
            return {
                docker_image: response.attributes.docker_image,
                startup: response.attributes.startup,
                variables: variables
            };
        }

        return { docker_image: '', startup: '', variables: [] };
    } catch (error) {
        logger.error(`Failed to get egg variables: ${error.message}`);
        throw error;
    }
}

/**
 * Create an allocation on a node
 */
async function createAllocation(nodeId, ip, port) {
    try {
        const response = await pterodactylRequest('POST', `/api/application/nodes/${nodeId}/allocations`, {
            ip: ip,
            ports: [port.toString()]
        });
        logger.info(`Created allocation: ${ip}:${port} on node ${nodeId}`);
        return true;
    } catch (error) {
        logger.error(`Failed to create allocation ${ip}:${port}: ${error.message}`);
        return false;
    }
}

/**
 * Get available allocations from a node
 */
async function getNodeAllocations(nodeId) {
    try {
        const response = await pterodactylRequest('GET', `/api/application/nodes/${nodeId}/allocations?per_page=500`);
        if (response.data) {
            return response.data.map(a => ({
                id: a.attributes.id,
                ip: a.attributes.ip,
                port: a.attributes.port,
                assigned: a.attributes.assigned
            }));
        }
        return [];
    } catch (error) {
        logger.error(`Failed to get node allocations: ${error.message}`);
        return [];
    }
}

/**
 * Get or create an allocation for a specific port
 */
async function getOrCreateAllocation(nodeId, ip, port) {
    // First check if allocation exists
    const allocations = await getNodeAllocations(nodeId);
    const existing = allocations.find(a => a.port === port && !a.assigned);

    if (existing) {
        logger.info(`Found existing unassigned allocation: ${ip}:${port} (ID: ${existing.id})`);
        return existing.id;
    }

    // Check if port is already assigned
    const assigned = allocations.find(a => a.port === port && a.assigned);
    if (assigned) {
        logger.warn(`Port ${port} is already assigned to another server`);
        return null;
    }

    // Create new allocation
    const created = await createAllocation(nodeId, ip, port);
    if (created) {
        // Refresh and get the new allocation ID
        const updatedAllocations = await getNodeAllocations(nodeId);
        const newAllocation = updatedAllocations.find(a => a.port === port && !a.assigned);
        if (newAllocation) {
            return newAllocation.id;
        }
    }

    return null;
}

/**
 * Create a server on Pterodactyl with custom environment variables
 */
async function createPterodactylServer(userId, servicePlan, serverName, eggConfig, customEnvironment) {
    try {
        // Build environment from egg variables with custom overrides
        const environment = {};
        if (eggConfig && eggConfig.variables) {
            eggConfig.variables.forEach(v => {
                environment[v.env_variable] = customEnvironment[v.env_variable] || v.default_value || '';
            });
        }

        // Set specific FiveM version (build 23683)
        environment.FIVEM_VERSION = '23683-1062db8a7b8e0c03f7c159be4cbfa181f49b2cc1';

        // Enable txAdmin
        environment.TXADMIN_ENABLE = '1';

        // Node IP for allocations (get from existing allocations or config)
        const NODE_IP = '92.118.206.129';  // Your server IP

        // Generate random ports in range
        const gamePort = 30100 + Math.floor(Math.random() * 900);    // 30100-30999
        const txAdminPort = 40100 + Math.floor(Math.random() * 900); // 40100-40999

        logger.info(`Generating ports - Game: ${gamePort}, txAdmin: ${txAdminPort}`);

        // Get or create allocation for game port
        const gameAllocationId = await getOrCreateAllocation(PTERODACTYL_CONFIG.nodeId, NODE_IP, gamePort);
        if (!gameAllocationId) {
            throw new Error(`Не може да се създаде allocation за game port ${gamePort}`);
        }

        // Get or create allocation for txAdmin port
        const txAdminAllocationId = await getOrCreateAllocation(PTERODACTYL_CONFIG.nodeId, NODE_IP, txAdminPort);
        if (!txAdminAllocationId) {
            throw new Error(`Не може да се създаде allocation за txAdmin port ${txAdminPort}`);
        }

        environment.SERVER_PORT = gamePort.toString();
        environment.TXADMIN_PORT = txAdminPort.toString();

        logger.info(`Created allocations - Game: ${gamePort} (ID: ${gameAllocationId}), txAdmin: ${txAdminPort} (ID: ${txAdminAllocationId})`);

        const serverData = {
            name: serverName || `CloudiX-${Date.now()}`,
            user: userId,
            egg: PTERODACTYL_CONFIG.eggId,
            docker_image: eggConfig?.docker_image || 'ghcr.io/pterodactyl/yolks:debian',
            startup: eggConfig?.startup || '',
            environment: environment,
            limits: {
                memory: servicePlan.pterodactyl.memory,
                swap: 0,
                disk: servicePlan.pterodactyl.disk,
                io: 500,
                cpu: servicePlan.pterodactyl.cpu
            },
            feature_limits: {
                databases: servicePlan.pterodactyl.databases,
                backups: servicePlan.pterodactyl.backups,
                allocations: 2
            },
            allocation: {
                default: gameAllocationId,
                additional: [txAdminAllocationId]
            }
        };

        logger.info(`Creating server with data: ${JSON.stringify(serverData, null, 2)}`);

        const server = await pterodactylRequest('POST', '/api/application/servers', serverData);

        if (!server || !server.attributes) {
            throw new Error('Invalid response from Pterodactyl API');
        }

        // Log the allocated ports
        const defaultAllocation = server.attributes.allocation;
        logger.info(`Created Pterodactyl server: ${server.attributes.identifier}`);
        logger.info(`Server allocated with primary port allocation ID: ${defaultAllocation}`);

        return server.attributes;
    } catch (error) {
        logger.error(`Failed to create Pterodactyl server: ${error.message}`);
        throw error;
    }
}

/**
 * Generate a random password for new users
 */
function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Register all IPC handlers
function registerHandlers() {
    initializeUserData();
    initializeSettings();

    // ================================
    // Pterodactyl Login Handlers
    // ================================

    // Login with Pterodactyl Client API Key
    ipcMain.handle('pterodactyl-login', async (event, clientApiKey) => {
        try {
            if (!clientApiKey || clientApiKey.length < 10) {
                return { success: false, error: 'Невалиден API ключ' };
            }

            logger.info('Attempting Pterodactyl login...');

            // Get account info using Client API
            const accountInfo = await pterodactylClientRequest('GET', '/api/client/account', clientApiKey);

            if (!accountInfo || !accountInfo.attributes) {
                return { success: false, error: 'Невалиден API ключ' };
            }

            const user = accountInfo.attributes;

            // Get user's servers
            const serversResponse = await pterodactylClientRequest('GET', '/api/client', clientApiKey);
            const servers = serversResponse.data ? serversResponse.data.map(s => ({
                id: s.attributes.identifier,
                uuid: s.attributes.uuid,
                name: s.attributes.name,
                description: s.attributes.description,
                status: s.attributes.status,
                node: s.attributes.node,
                limits: s.attributes.limits,
                ip: s.attributes.relationships?.allocations?.data?.[0]?.attributes?.ip || '',
                port: s.attributes.relationships?.allocations?.data?.[0]?.attributes?.port || ''
            })) : [];

            // Save login info
            userStore.set('pterodactylApiKey', clientApiKey);
            userStore.set('pterodactylAccountId', user.id);
            userStore.set('pterodactylEmail', user.email);
            userStore.set('pterodactylUsername', user.username);
            userStore.set('pterodactylAdmin', user.admin);
            userStore.set('isLoggedIn', true);
            userStore.set('email', user.email);
            userStore.set('username', user.username);

            logger.info(`Pterodactyl login successful: ${user.username} (Admin: ${user.admin})`);

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isAdmin: user.admin,
                    language: user.language
                },
                servers: servers
            };
        } catch (error) {
            logger.error(`Pterodactyl login error: ${error.message}`);
            return { success: false, error: error.message || 'Грешка при вход' };
        }
    });

    // Get logged in user's servers
    ipcMain.handle('get-pterodactyl-servers', async () => {
        try {
            const apiKey = userStore.get('pterodactylApiKey');
            if (!apiKey) {
                return { success: false, error: 'Не си логнат' };
            }

            const serversResponse = await pterodactylClientRequest('GET', '/api/client', apiKey);
            const servers = serversResponse.data ? serversResponse.data.map(s => ({
                id: s.attributes.identifier,
                uuid: s.attributes.uuid,
                name: s.attributes.name,
                description: s.attributes.description,
                status: s.attributes.status,
                node: s.attributes.node,
                limits: s.attributes.limits
            })) : [];

            return { success: true, servers };
        } catch (error) {
            logger.error(`Get servers error: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    // Check if logged in
    ipcMain.handle('check-login-status', () => {
        const isLoggedIn = userStore.get('isLoggedIn', false);
        if (isLoggedIn) {
            return {
                isLoggedIn: true,
                user: {
                    username: userStore.get('pterodactylUsername'),
                    email: userStore.get('pterodactylEmail'),
                    isAdmin: userStore.get('pterodactylAdmin', false)
                }
            };
        }
        return { isLoggedIn: false };
    });

    // Logout
    ipcMain.handle('pterodactyl-logout', () => {
        userStore.delete('pterodactylApiKey');
        userStore.delete('pterodactylAccountId');
        userStore.delete('isLoggedIn');
        logger.info('User logged out');
        return { success: true };
    });

    // ================================
    // Admin Panel Handlers
    // ================================

    // Check if current user is admin
    function isCurrentUserAdmin() {
        return userStore.get('pterodactylAdmin', false);
    }

    // Admin: Add coins to a user (by email)
    ipcMain.handle('admin-add-coins', async (event, { email, amount }) => {
        try {
            if (!isCurrentUserAdmin()) {
                return { success: false, error: 'Нямаш администраторски права' };
            }

            if (!email || !amount || amount < 1) {
                return { success: false, error: 'Невалидни данни' };
            }

            // For now, only works if the user currently logged in
            // In a full system, you'd have a database of users
            const currentEmail = userStore.get('email');

            if (email.toLowerCase() === currentEmail?.toLowerCase()) {
                const currentCoins = userStore.get('coins', 0);
                const newBalance = currentCoins + parseInt(amount);
                userStore.set('coins', newBalance);
                logger.info(`Admin added ${amount} coins to ${email}. New balance: ${newBalance}`);
                return { success: true, newBalance, message: `Добавени ${amount} монети на ${email}` };
            } else {
                // Store pending coins for other users (they'll receive when they login)
                const pendingCoins = userStore.get('pendingCoins', {});
                pendingCoins[email.toLowerCase()] = (pendingCoins[email.toLowerCase()] || 0) + parseInt(amount);
                userStore.set('pendingCoins', pendingCoins);
                logger.info(`Admin queued ${amount} coins for ${email}`);
                return { success: true, message: `${amount} монети ще бъдат добавени на ${email} при следващ вход` };
            }
        } catch (error) {
            logger.error(`Admin add coins error: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    // Admin: Reset user redemption status
    ipcMain.handle('admin-reset-user', async (event, { email }) => {
        try {
            if (!isCurrentUserAdmin()) {
                return { success: false, error: 'Нямаш администраторски права' };
            }

            if (!email) {
                return { success: false, error: 'Въведи email' };
            }

            const currentEmail = userStore.get('email');

            if (email.toLowerCase() === currentEmail?.toLowerCase()) {
                userStore.set('hasRedeemed', false);
                userStore.delete('redeemedService');
                userStore.delete('pterodactylServerId');
                logger.info(`Admin reset redemption for ${email}`);
                return { success: true, message: `Reset redemption за ${email}` };
            } else {
                // Store reset request for other users
                const pendingResets = userStore.get('pendingResets', []);
                if (!pendingResets.includes(email.toLowerCase())) {
                    pendingResets.push(email.toLowerCase());
                    userStore.set('pendingResets', pendingResets);
                }
                logger.info(`Admin queued reset for ${email}`);
                return { success: true, message: `Reset ще бъде приложен на ${email} при следващ вход` };
            }
        } catch (error) {
            logger.error(`Admin reset user error: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    // Admin: Reset all data for a user
    ipcMain.handle('admin-reset-all', async (event, { email }) => {
        try {
            if (!isCurrentUserAdmin()) {
                return { success: false, error: 'Нямаш администраторски права' };
            }

            if (!email) {
                return { success: false, error: 'Въведи email' };
            }

            const currentEmail = userStore.get('email');

            if (email.toLowerCase() === currentEmail?.toLowerCase()) {
                userStore.set('coins', 0);
                userStore.set('hasRedeemed', false);
                userStore.delete('redeemedService');
                userStore.delete('pterodactylServerId');
                userStore.set('completedQuests', {});
                logger.info(`Admin reset all data for ${email}`);
                return { success: true, message: `Reset всички данни за ${email}` };
            }

            return { success: true, message: `Reset ще бъде приложен на ${email} при следващ вход` };
        } catch (error) {
            logger.error(`Admin reset all error: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    // Get user data
    ipcMain.handle('get-user-data', () => {
        logger.debug('Getting user data');
        return {
            username: userStore.get('username'),
            email: userStore.get('email', ''),
            coins: userStore.get('coins'),
            hasRedeemed: userStore.get('hasRedeemed'),
            redeemedService: userStore.get('redeemedService'),
            pterodactylUserId: userStore.get('pterodactylUserId'),
            pterodactylServerId: userStore.get('pterodactylServerId')
        };
    });

    // Save user data (username and email)
    ipcMain.handle('save-user-data', (event, data) => {
        let updated = false;

        if (data.username && typeof data.username === 'string') {
            const sanitized = data.username.trim().substring(0, 50);
            userStore.set('username', sanitized);
            logger.info(`Username updated to: ${sanitized}`);
            updated = true;
        }

        if (data.email && typeof data.email === 'string') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(data.email)) {
                userStore.set('email', data.email.trim().toLowerCase());
                logger.info(`Email updated to: ${data.email}`);
                updated = true;
            }
        }

        if (updated) {
            return { success: true };
        }
        return { success: false, error: 'Invalid data' };
    });

    // Get quests with claim status
    ipcMain.handle('get-quests', () => {
        logger.debug('Getting quests');
        const userQuests = userStore.get('quests', {});

        return QUESTS.map(quest => ({
            ...quest,
            canClaim: canClaimQuest(quest.id),
            lastClaimed: userQuests[quest.id]?.lastClaimed || null
        }));
    });

    // Claim a quest
    ipcMain.handle('claim-quest', (event, questId) => {
        const quest = QUESTS.find(q => q.id === questId);

        if (!quest) {
            logger.warn(`Invalid quest ID: ${questId}`);
            return { success: false, error: 'Invalid quest' };
        }

        if (!canClaimQuest(questId)) {
            logger.warn(`Quest already claimed today: ${questId}`);
            return { success: false, error: 'Already claimed today' };
        }

        // Update quest claim time
        const quests = userStore.get('quests', {});
        quests[questId] = { lastClaimed: new Date().toISOString() };
        userStore.set('quests', quests);

        // Add coins
        const currentCoins = userStore.get('coins', 0);
        userStore.set('coins', currentCoins + quest.coins);

        logger.info(`Quest claimed: ${quest.title} (+${quest.coins} coins)`);

        return {
            success: true,
            coinsEarned: quest.coins,
            newBalance: currentCoins + quest.coins
        };
    });

    // Get available services
    ipcMain.handle('get-services', () => {
        logger.debug('Getting services');
        // Return services without pterodactyl internal config
        return SERVICES.map(s => ({
            id: s.id,
            name: s.name,
            cost: s.cost,
            features: s.features
        }));
    });

    // Step 1: Validate redemption and get egg variables
    ipcMain.handle('validate-redeem', async (event, serviceId) => {
        try {
            // Check if already redeemed
            if (userStore.get('hasRedeemed')) {
                return { success: false, error: 'Вече си използвал своето redemption!' };
            }

            const service = SERVICES.find(s => s.id === serviceId);
            if (!service) {
                return { success: false, error: 'Невалиден план' };
            }

            const currentCoins = userStore.get('coins', 0);
            if (currentCoins < service.cost) {
                return { success: false, error: `Нямаш достатъчно монети! Имаш ${currentCoins}, нужни са ${service.cost}` };
            }

            const email = userStore.get('email', '');
            if (!email) {
                return { success: false, error: 'Моля въведи email адрес в Dashboard!' };
            }

            // Check Pterodactyl config
            if (PTERODACTYL_CONFIG.apiKey === 'YOUR_PTERODACTYL_API_KEY_HERE') {
                return { success: false, error: 'Pterodactyl не е конфигуриран!' };
            }

            // Find user in Pterodactyl
            const pterodactylUser = await findPterodactylUser(email);
            if (!pterodactylUser) {
                return {
                    success: false,
                    error: `❌ Няма акаунт в панела с този email: ${email}\n\nРегистрирай се в ${PTERODACTYL_CONFIG.panelUrl}`
                };
            }

            // Get egg variables
            const eggConfig = await getEggVariables(PTERODACTYL_CONFIG.nestId, PTERODACTYL_CONFIG.eggId);

            logger.info(`Validation passed for ${email}, returning ${eggConfig.variables.length} egg variables`);

            return {
                success: true,
                service: service,
                pterodactylUserId: pterodactylUser.id,
                eggConfig: eggConfig,
                panelUrl: PTERODACTYL_CONFIG.panelUrl
            };
        } catch (error) {
            logger.error(`Validate redeem error: ${error.message}`);
            return { success: false, error: `Грешка: ${error.message}` };
        }
    });

    // Step 2: Create server with custom environment variables
    ipcMain.handle('confirm-redeem', async (event, { serviceId, serverName, environment }) => {
        try {
            // Re-validate
            if (userStore.get('hasRedeemed')) {
                return { success: false, error: 'Вече си използвал своето redemption!' };
            }

            const service = SERVICES.find(s => s.id === serviceId);
            if (!service) {
                return { success: false, error: 'Невалиден план' };
            }

            const currentCoins = userStore.get('coins', 0);
            if (currentCoins < service.cost) {
                return { success: false, error: 'Няма достатъчно монети!' };
            }

            const email = userStore.get('email', '');
            const pterodactylUser = await findPterodactylUser(email);
            if (!pterodactylUser) {
                return { success: false, error: 'Pterodactyl акаунтът не е намерен!' };
            }

            // Get egg config again
            const eggConfig = await getEggVariables(PTERODACTYL_CONFIG.nestId, PTERODACTYL_CONFIG.eggId);

            // Create server with custom environment
            const server = await createPterodactylServer(
                pterodactylUser.id,
                service,
                serverName || `FiveM-${Date.now()}`,
                eggConfig,
                environment || {}
            );

            // Deduct coins and mark as redeemed
            userStore.set('coins', currentCoins - service.cost);
            userStore.set('hasRedeemed', true);
            userStore.set('redeemedService', service.name);
            userStore.set('pterodactylUserId', pterodactylUser.id);
            userStore.set('pterodactylServerId', server.identifier);

            logger.info(`Server created: ${server.identifier} for user ${pterodactylUser.id}`);

            return {
                success: true,
                service: service.name,
                newBalance: currentCoins - service.cost,
                pterodactylServerId: server.identifier,
                message: `🎉 FiveM сървърът е създаден!\nID: ${server.identifier}\nПанел: ${PTERODACTYL_CONFIG.panelUrl}`
            };
        } catch (error) {
            logger.error(`Confirm redeem error: ${error.message}`);
            return { success: false, error: `Грешка при създаване: ${error.message}` };
        }
    });

    // Get Pterodactyl config status
    ipcMain.handle('get-pterodactyl-status', () => {
        return {
            configured: PTERODACTYL_CONFIG.apiKey !== 'YOUR_PTERODACTYL_API_KEY_HERE',
            panelUrl: PTERODACTYL_CONFIG.panelUrl
        };
    });

    // Get settings
    ipcMain.handle('get-settings', () => {
        logger.debug('Getting settings');
        return {
            theme: settingsStore.get('theme', 'dark')
        };
    });

    // Save settings
    ipcMain.handle('save-settings', (event, settings) => {
        if (settings.theme && ['dark', 'light'].includes(settings.theme)) {
            settingsStore.set('theme', settings.theme);
            logger.info(`Theme changed to: ${settings.theme}`);
            return { success: true };
        }
        return { success: false, error: 'Invalid settings' };
    });

    // Reset all data
    ipcMain.handle('reset-data', () => {
        logger.info('Resetting all user data');
        userStore.clear();
        initializeUserData();
        return { success: true };
    });

    // Open external URL
    ipcMain.handle('open-external', (event, url) => {
        // Only allow specific URLs
        const allowedPatterns = [
            /^https:\/\/discord\.com\//,
            /^https:\/\/discord\.gg\//,
            /^https:\/\/cloudix\./,
            /^https:\/\/panel\.cloudix/
        ];

        if (allowedPatterns.some(pattern => pattern.test(url))) {
            shell.openExternal(url);
            logger.info(`Opened external URL: ${url}`);
            return { success: true };
        }

        logger.warn(`Blocked external URL: ${url}`);
        return { success: false, error: 'URL not allowed' };
    });

    logger.info('IPC handlers registered');

    // ================================
    // UPDATE SYSTEM HANDLERS
    // ================================

    const APP_VERSION = '1.0.0';
    const UPDATE_CHECK_URL = 'https://cloudixhosting.site/update.json';
    const DOWNLOAD_URL = 'https://cloudixhosting.site/download';

    // Get current app version
    ipcMain.handle('get-app-version', () => {
        return { success: true, version: APP_VERSION };
    });

    // Check for updates
    ipcMain.handle('check-for-updates', async () => {
        logger.info('Checking for updates...');

        return new Promise((resolve) => {
            const url = new URL(UPDATE_CHECK_URL);
            const protocol = url.protocol === 'https:' ? https : http;

            const req = protocol.get(UPDATE_CHECK_URL, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const updateInfo = JSON.parse(data);
                        const hasUpdate = compareVersions(updateInfo.version, APP_VERSION) > 0;

                        logger.info(`Update check: current=${APP_VERSION}, latest=${updateInfo.version}, hasUpdate=${hasUpdate}`);

                        resolve({
                            success: true,
                            hasUpdate,
                            currentVersion: APP_VERSION,
                            latestVersion: updateInfo.version,
                            downloadUrl: updateInfo.downloadUrl || DOWNLOAD_URL,
                            changelog: updateInfo.changelog || []
                        });
                    } catch (e) {
                        logger.error('Failed to parse update info:', e.message);
                        resolve({ success: false, error: 'Failed to check for updates' });
                    }
                });
            });

            req.on('error', (e) => {
                logger.error('Update check failed:', e.message);
                resolve({ success: false, error: 'Network error' });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        });
    });

    // Download update (opens download URL)
    ipcMain.handle('download-update', async () => {
        shell.openExternal(DOWNLOAD_URL);
        logger.info('Opened download URL for update');
        return { success: true };
    });

    // Version comparison helper
    function compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }
}

module.exports = { registerHandlers };
