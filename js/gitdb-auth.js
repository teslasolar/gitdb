/**
 * GitDB Authentication Module
 *
 * Seamless GitHub authentication with:
 * - Auto-detection of existing auth
 * - Device Flow (no backend needed)
 * - OAuth Flow (with proxy)
 * - Persistent sessions
 */

class GitDBAuth {
    /**
     * Create auth handler
     * @param {Object} config
     * @param {string} config.clientId - GitHub OAuth App client ID
     * @param {string} [config.proxyUrl] - URL for OAuth token exchange proxy
     * @param {string[]} [config.scopes] - OAuth scopes (default: ['repo'])
     * @param {string} [config.corsProxy] - CORS proxy URL (default: uses corsproxy.io)
     */
    constructor(config = {}) {
        this.clientId = config.clientId;
        this.proxyUrl = config.proxyUrl;
        this.scopes = config.scopes || ['repo'];
        this.storageKey = 'gitdb_auth';
        this._user = null;
        // CORS proxy for GitHub OAuth endpoints (needed for browser requests)
        this.corsProxy = config.corsProxy || 'https://corsproxy.io/?';
    }

    // ============================================
    // AUTO AUTHENTICATION
    // ============================================

    /**
     * Automatically authenticate - checks existing session first
     * @param {Object} [options]
     * @param {boolean} [options.silent=true] - Don't prompt if no existing auth
     * @param {boolean} [options.useUI=true] - Show UI for device flow
     * @returns {Promise<Object|null>} User data or null
     */
    async auto(options = {}) {
        const { silent = true, useUI = true } = options;

        // 1. Check for existing valid token
        const existing = await this.checkExisting();
        if (existing) {
            console.log('[GitDB] Auto-authenticated from stored token');
            return existing;
        }

        // 2. Check for OAuth callback
        const callback = await this.handleOAuthCallback().catch(() => null);
        if (callback) {
            const user = await this.getUser();
            console.log('[GitDB] Authenticated via OAuth callback');
            return user;
        }

        // 3. If silent mode, don't prompt
        if (silent) {
            return null;
        }

        // 4. Start device flow
        if (useUI && this.clientId) {
            return await this.login();
        }

        return null;
    }

    /**
     * Check if there's an existing valid token
     * @returns {Promise<Object|null>} User data or null
     */
    async checkExisting() {
        const token = this.getAccessToken();
        if (!token) return null;

        try {
            const user = await this.getUser();
            this._user = user;
            return user;
        } catch (error) {
            // Token invalid/expired
            console.log('[GitDB] Stored token invalid, clearing');
            this.logout();
            return null;
        }
    }

    /**
     * Login - shows UI for authentication
     * @returns {Promise<Object>} User data
     */
    async login() {
        if (!this.clientId) {
            throw new Error('clientId required. Create a GitHub OAuth App first.');
        }

        const token = await this.deviceFlowWithUI();
        const user = await this.getUser();
        this._user = user;
        return user;
    }

    /**
     * Quick connect - auto-auth or prompt
     * Returns a ready-to-use GitDB instance
     * @param {string} owner - Repo owner (or null to prompt)
     * @param {string} repo - Repo name (or null to prompt)
     * @returns {Promise<GitDB>}
     */
    async connect(owner, repo) {
        // Ensure authenticated
        let user = await this.auto({ silent: true });
        if (!user) {
            user = await this.login();
        }

        // If no owner specified, use authenticated user
        if (!owner) {
            owner = user.login;
        }

        // If no repo specified, show picker
        if (!repo) {
            repo = await this.showRepoPicker(owner);
        }

        return this.createDB(owner, repo);
    }

    /**
     * Create GitDB instance with current auth
     * @param {string} owner
     * @param {string} repo
     * @param {Object} [options]
     * @returns {GitDB}
     */
    createDB(owner, repo, options = {}) {
        const token = this.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        return new GitDB({
            owner,
            repo,
            token,
            ...options
        });
    }

    // ============================================
    // DEVICE FLOW (no backend required!)
    // ============================================

    /**
     * Start Device Flow
     * @returns {Promise<Object>} Device code data
     */
    async startDeviceFlow() {
        const url = this.corsProxy + encodeURIComponent('https://github.com/login/device/code');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: this.clientId,
                scope: this.scopes.join(' ')
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error_description || 'Failed to start device flow');
        }

        return await response.json();
    }

    /**
     * Poll for device flow completion
     * @param {string} deviceCode
     * @param {number} [interval=5]
     * @param {number} [timeout=900]
     * @returns {Promise<Object>} Token data
     */
    async pollDeviceFlow(deviceCode, interval = 5, timeout = 900) {
        const startTime = Date.now();
        const url = this.corsProxy + encodeURIComponent('https://github.com/login/oauth/access_token');

        while (Date.now() - startTime < timeout * 1000) {
            await this._sleep(interval * 1000);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: this.clientId,
                    device_code: deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                })
            });

            const data = await response.json();

            if (data.access_token) {
                this._saveToken(data);
                return data;
            }

            switch (data.error) {
                case 'authorization_pending':
                    continue;
                case 'slow_down':
                    interval += 5;
                    continue;
                case 'expired_token':
                    throw new Error('Code expired. Please try again.');
                case 'access_denied':
                    throw new Error('Access denied.');
                default:
                    if (data.error) {
                        throw new Error(data.error_description || data.error);
                    }
            }
        }

        throw new Error('Timeout waiting for authorization');
    }

    /**
     * Device flow with built-in UI
     * @returns {Promise<Object>} Token data
     */
    async deviceFlowWithUI() {
        const deviceData = await this.startDeviceFlow();

        return new Promise((resolve, reject) => {
            const modal = this._createAuthModal(deviceData);
            document.body.appendChild(modal);

            let cancelled = false;

            modal.querySelector('.gitdb-auth-cancel').onclick = () => {
                cancelled = true;
                modal.remove();
                reject(new Error('Cancelled'));
            };

            // Auto-open GitHub in new tab
            const link = modal.querySelector('.gitdb-auth-link');

            // Copy code to clipboard
            const codeEl = modal.querySelector('.gitdb-auth-code');
            codeEl.onclick = () => {
                navigator.clipboard?.writeText(deviceData.user_code);
                codeEl.style.background = '#dcfce7';
                setTimeout(() => codeEl.style.background = '', 500);
            };

            this.pollDeviceFlow(
                deviceData.device_code,
                deviceData.interval || 5,
                deviceData.expires_in || 900
            ).then(token => {
                if (!cancelled) {
                    modal.querySelector('.gitdb-auth-status').textContent = 'Success!';
                    modal.querySelector('.gitdb-auth-status').style.color = '#16a34a';
                    setTimeout(() => modal.remove(), 500);
                    resolve(token);
                }
            }).catch(error => {
                if (!cancelled) {
                    modal.querySelector('.gitdb-auth-status').textContent = error.message;
                    modal.querySelector('.gitdb-auth-status').style.color = '#dc2626';
                }
                reject(error);
            });
        });
    }

    // ============================================
    // OAUTH FLOW (requires proxy)
    // ============================================

    /**
     * Start OAuth redirect flow
     * @param {string} [redirectUri]
     */
    startOAuthFlow(redirectUri) {
        const state = this._generateState();
        sessionStorage.setItem('gitdb_oauth_state', state);

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: redirectUri || window.location.href.split('?')[0],
            scope: this.scopes.join(' '),
            state: state
        });

        window.location.href = `https://github.com/login/oauth/authorize?${params}`;
    }

    /**
     * Handle OAuth callback
     * @returns {Promise<Object|null>}
     */
    async handleOAuthCallback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        if (error) {
            throw new Error(params.get('error_description') || error);
        }

        if (!code) return null;

        const savedState = sessionStorage.getItem('gitdb_oauth_state');
        if (state !== savedState) {
            throw new Error('State mismatch');
        }
        sessionStorage.removeItem('gitdb_oauth_state');

        if (!this.proxyUrl) {
            throw new Error('proxyUrl required for OAuth');
        }

        const response = await fetch(this.proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        if (!response.ok) throw new Error('Token exchange failed');

        const data = await response.json();
        this._saveToken(data);

        window.history.replaceState({}, '', window.location.pathname);

        return data;
    }

    // ============================================
    // TOKEN MANAGEMENT
    // ============================================

    getToken() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey));
        } catch {
            return null;
        }
    }

    getAccessToken() {
        return this.getToken()?.access_token || null;
    }

    isAuthenticated() {
        return !!this.getAccessToken();
    }

    logout() {
        localStorage.removeItem(this.storageKey);
        this._user = null;
    }

    async getUser() {
        if (this._user) return this._user;

        const token = this.getAccessToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Token expired');
            }
            throw new Error('Failed to get user');
        }

        this._user = await response.json();
        return this._user;
    }

    /**
     * Get current user (cached)
     * @returns {Object|null}
     */
    get user() {
        return this._user;
    }

    async listRepos(options = {}) {
        const token = this.getAccessToken();
        if (!token) throw new Error('Not authenticated');

        const params = new URLSearchParams({
            sort: options.sort || 'updated',
            per_page: String(options.perPage || 100),
            page: String(options.page || 1),
            type: options.type || 'all'
        });

        const response = await fetch(`https://api.github.com/user/repos?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error('Failed to list repos');

        return await response.json();
    }

    // ============================================
    // UI HELPERS
    // ============================================

    /**
     * Show repo picker dialog
     * @param {string} [owner]
     * @returns {Promise<string>} Selected repo name
     */
    async showRepoPicker(owner) {
        const repos = await this.listRepos();

        return new Promise((resolve, reject) => {
            const modal = document.createElement('div');
            modal.innerHTML = `
                <div class="gitdb-auth-overlay">
                    <div class="gitdb-auth-dialog" style="max-height: 80vh; display: flex; flex-direction: column;">
                        <h2>Select Repository</h2>
                        <input type="text" class="gitdb-repo-search" placeholder="Search repos..." style="
                            width: 100%;
                            padding: 10px;
                            margin: 10px 0;
                            border: 1px solid #ddd;
                            border-radius: 6px;
                            font-size: 14px;
                        ">
                        <div class="gitdb-repo-list" style="
                            flex: 1;
                            overflow-y: auto;
                            border: 1px solid #eee;
                            border-radius: 8px;
                            max-height: 300px;
                        "></div>
                        <button class="gitdb-auth-cancel" style="margin-top: 16px;">Cancel</button>
                    </div>
                </div>
            `;

            this._addAuthStyles();
            document.body.appendChild(modal);

            const listEl = modal.querySelector('.gitdb-repo-list');
            const searchEl = modal.querySelector('.gitdb-repo-search');

            const renderRepos = (filter = '') => {
                const filtered = repos.filter(r =>
                    r.full_name.toLowerCase().includes(filter.toLowerCase())
                );
                listEl.innerHTML = filtered.map(r => `
                    <div class="gitdb-repo-item" data-repo="${r.name}" data-owner="${r.owner.login}" style="
                        padding: 12px 16px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div>
                            <strong>${r.name}</strong>
                            <div style="font-size: 12px; color: #666;">${r.owner.login}</div>
                        </div>
                        <div style="font-size: 12px; color: #888;">
                            ${r.private ? '🔒' : '🌐'}
                        </div>
                    </div>
                `).join('') || '<div style="padding: 20px; text-align: center; color: #666;">No repos found</div>';
            };

            renderRepos();

            searchEl.oninput = () => renderRepos(searchEl.value);

            listEl.onclick = (e) => {
                const item = e.target.closest('.gitdb-repo-item');
                if (item) {
                    modal.remove();
                    resolve(item.dataset.repo);
                }
            };

            modal.querySelector('.gitdb-auth-cancel').onclick = () => {
                modal.remove();
                reject(new Error('Cancelled'));
            };
        });
    }

    /**
     * Show login button that triggers auth on click
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} [options]
     * @returns {Promise<Object>} Resolves with user when authenticated
     */
    showLoginButton(container, options = {}) {
        const el = typeof container === 'string' ?
            document.querySelector(container) : container;

        if (!el) throw new Error('Container not found');

        return new Promise((resolve, reject) => {
            // Check if already authenticated
            this.checkExisting().then(user => {
                if (user) {
                    el.innerHTML = `
                        <div class="gitdb-user-badge">
                            <img src="${user.avatar_url}" alt="" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;">
                            <span style="margin-left:8px;">${user.login}</span>
                            <button class="gitdb-logout-btn" style="margin-left:12px;padding:4px 8px;font-size:12px;cursor:pointer;">Logout</button>
                        </div>
                    `;
                    el.querySelector('.gitdb-logout-btn').onclick = () => {
                        this.logout();
                        this.showLoginButton(container, options).then(resolve).catch(reject);
                    };
                    resolve(user);
                    return;
                }

                // Show login button
                el.innerHTML = `
                    <button class="gitdb-login-btn" style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 10px 20px;
                        background: #24292e;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                    ">
                        <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                        </svg>
                        Login with GitHub
                    </button>
                `;

                el.querySelector('.gitdb-login-btn').onclick = async () => {
                    try {
                        el.querySelector('.gitdb-login-btn').disabled = true;
                        el.querySelector('.gitdb-login-btn').textContent = 'Connecting...';
                        const user = await this.login();
                        this.showLoginButton(container, options).then(resolve);
                    } catch (error) {
                        el.querySelector('.gitdb-login-btn').disabled = false;
                        el.querySelector('.gitdb-login-btn').innerHTML = `
                            <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                            </svg>
                            Login with GitHub
                        `;
                        reject(error);
                    }
                };
            });
        });
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    _createAuthModal(deviceData) {
        this._addAuthStyles();

        const modal = document.createElement('div');
        modal.id = 'gitdb-auth-modal';
        modal.innerHTML = `
            <div class="gitdb-auth-overlay">
                <div class="gitdb-auth-dialog">
                    <h2>Connect to GitHub</h2>
                    <p>1. Copy this code (click to copy):</p>
                    <div class="gitdb-auth-code" title="Click to copy">${deviceData.user_code}</div>
                    <p>2. Enter it at GitHub:</p>
                    <a href="${deviceData.verification_uri}" target="_blank" class="gitdb-auth-link">
                        Open GitHub Device Activation
                    </a>
                    <p class="gitdb-auth-status">Waiting for authorization...</p>
                    <button class="gitdb-auth-cancel">Cancel</button>
                </div>
            </div>
        `;
        return modal;
    }

    _addAuthStyles() {
        if (document.getElementById('gitdb-auth-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'gitdb-auth-styles';
        styles.textContent = `
            .gitdb-auth-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .gitdb-auth-dialog {
                background: white;
                padding: 32px;
                border-radius: 16px;
                text-align: center;
                max-width: 420px;
                width: 90%;
                box-shadow: 0 25px 80px rgba(0,0,0,0.4);
            }
            .gitdb-auth-dialog h2 {
                margin: 0 0 20px;
                color: #1a1a1a;
            }
            .gitdb-auth-dialog p {
                margin: 12px 0;
                color: #444;
            }
            .gitdb-auth-code {
                font-size: 36px;
                font-weight: bold;
                font-family: 'SF Mono', Monaco, monospace;
                letter-spacing: 6px;
                padding: 20px 28px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                margin: 16px 0;
                cursor: pointer;
                user-select: all;
                transition: transform 0.15s, box-shadow 0.15s;
            }
            .gitdb-auth-code:hover {
                transform: scale(1.02);
                box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
            }
            .gitdb-auth-link {
                display: inline-block;
                padding: 14px 28px;
                background: #24292e;
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
                margin: 12px 0;
                transition: background 0.2s;
            }
            .gitdb-auth-link:hover {
                background: #1a1e22;
            }
            .gitdb-auth-status {
                color: #666;
                margin: 20px 0 12px;
                animation: gitdb-pulse 2s infinite;
            }
            .gitdb-auth-cancel {
                padding: 10px 20px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 8px;
                cursor: pointer;
                color: #666;
                font-size: 14px;
            }
            .gitdb-auth-cancel:hover {
                background: #f5f5f5;
            }
            @keyframes gitdb-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(styles);
    }

    _saveToken(data) {
        localStorage.setItem(this.storageKey, JSON.stringify({
            access_token: data.access_token,
            token_type: data.token_type,
            scope: data.scope,
            created_at: Date.now()
        }));
    }

    _generateState() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// CONVENIENCE EXPORT
// ============================================

/**
 * Quick setup - call this once on page load
 * @param {string} clientId - GitHub OAuth App client ID
 * @returns {GitDBAuth}
 *
 * @example
 * const auth = GitDB.auth('your_client_id');
 *
 * // Auto-login on page load
 * const user = await auth.auto({ silent: false });
 *
 * // Or show login button
 * auth.showLoginButton('#login-container');
 *
 * // Create database connection
 * const db = auth.createDB('owner', 'repo');
 */
if (typeof GitDB !== 'undefined') {
    GitDB.auth = (clientId, options = {}) => new GitDBAuth({ clientId, ...options });
}

// Exports
if (typeof window !== 'undefined') {
    window.GitDBAuth = GitDBAuth;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GitDBAuth };
}
