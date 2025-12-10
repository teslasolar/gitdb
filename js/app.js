/**
 * GitDB Demo Application
 * Interactive UI for testing GitDB operations with auto-authentication
 */

// ============================================
// CONFIGURATION
// ============================================

// Replace with your GitHub OAuth App client ID
// Create one at: https://github.com/settings/applications/new
// Set callback URL to your app's URL (e.g., https://yourusername.github.io/gitdb/)
const GITHUB_CLIENT_ID = 'Ov23lifP6LVYo1cHv0dt';

// ============================================
// GLOBAL STATE
// ============================================

let auth = null;
let db = null;
let currentCollection = null;

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    // Auth
    authPanel: document.getElementById('auth-panel'),
    authStatus: document.getElementById('auth-status'),
    loginButtonContainer: document.getElementById('login-button-container'),
    token: document.getElementById('token'),
    manualConnectBtn: document.getElementById('manual-connect-btn'),

    // Repo Selection
    repoPanel: document.getElementById('repo-panel'),
    owner: document.getElementById('owner'),
    repo: document.getElementById('repo'),
    branch: document.getElementById('branch'),
    connectRepoBtn: document.getElementById('connect-repo-btn'),
    pickRepoBtn: document.getElementById('pick-repo-btn'),
    connectionStatus: document.getElementById('connection-status'),

    // Operations Panel
    operationsPanel: document.getElementById('operations-panel'),

    // Tabs
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Collections
    collectionName: document.getElementById('collection-name'),
    initCollectionBtn: document.getElementById('init-collection-btn'),
    loadCollectionBtn: document.getElementById('load-collection-btn'),
    collectionActions: document.getElementById('collection-actions'),
    currentCollectionSpan: document.getElementById('current-collection'),
    docId: document.getElementById('doc-id'),
    docData: document.getElementById('doc-data'),
    createDocBtn: document.getElementById('create-doc-btn'),
    readDocBtn: document.getElementById('read-doc-btn'),
    updateDocBtn: document.getElementById('update-doc-btn'),
    deleteDocBtn: document.getElementById('delete-doc-btn'),
    refreshDocsBtn: document.getElementById('refresh-docs-btn'),
    documentsList: document.getElementById('documents-list'),

    // Raw Operations
    rawPath: document.getElementById('raw-path'),
    rawContent: document.getElementById('raw-content'),
    rawGetBtn: document.getElementById('raw-get-btn'),
    rawSetBtn: document.getElementById('raw-set-btn'),
    rawDeleteBtn: document.getElementById('raw-delete-btn'),
    rawListBtn: document.getElementById('raw-list-btn'),

    // Query Builder
    queryCollection: document.getElementById('query-collection'),
    queryFilters: document.getElementById('query-filters'),
    addFilterBtn: document.getElementById('add-filter-btn'),
    querySort: document.getElementById('query-sort'),
    queryOrder: document.getElementById('query-order'),
    queryLimit: document.getElementById('query-limit'),
    executeQueryBtn: document.getElementById('execute-query-btn'),
    queryResults: document.getElementById('query-results'),

    // History
    historyPath: document.getElementById('history-path'),
    getHistoryBtn: document.getElementById('get-history-btn'),
    historyList: document.getElementById('history-list'),

    // Console
    console: document.getElementById('console'),
    clearConsoleBtn: document.getElementById('clear-console-btn')
};

// ============================================
// LOGGING
// ============================================

function log(message, type = 'info', data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    let html = `<span class="timestamp">[${timestamp}]</span>`;
    html += `<span class="log-${type}">${escapeHtml(message)}</span>`;

    if (data !== null) {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        html += `<div class="log-data">${escapeHtml(dataStr)}</div>`;
    }

    entry.innerHTML = html;
    elements.console.appendChild(entry);
    elements.console.scrollTop = elements.console.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    log('GitDB Demo initializing...', 'info');

    // Initialize auth
    auth = new GitDBAuth({
        clientId: GITHUB_CLIENT_ID,
        scopes: ['repo']
    });

    // Check for existing authentication
    log('Checking for existing authentication...', 'info');

    try {
        const user = await auth.auto({ silent: true });

        if (user) {
            onAuthenticated(user);
        } else {
            showLoginButton();
        }
    } catch (error) {
        log(`Auth check failed: ${error.message}`, 'error');
        showLoginButton();
    }

    // Setup event listeners
    setupEventListeners();
}

function showLoginButton() {
    elements.authStatus.innerHTML = '';

    // Show OAuth login button
    auth.showLoginButton(elements.loginButtonContainer).then(user => {
        onAuthenticated(user);
    }).catch(error => {
        if (error.message !== 'Cancelled') {
            log(`Login failed: ${error.message}`, 'error');
        }
    });

    log('Click "Login with GitHub" to authenticate', 'info');
}

function onAuthenticated(user) {
    log(`Authenticated as ${user.login}`, 'success');

    // Update header status
    elements.authStatus.innerHTML = `
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: #f0f9ff; border-radius: 20px; margin-top: 10px;">
            <img src="${user.avatar_url}" alt="" style="width: 24px; height: 24px; border-radius: 50%;">
            <span style="font-weight: 500;">${user.login}</span>
            <button id="logout-btn" style="padding: 4px 8px; font-size: 12px; cursor: pointer; border: 1px solid #ddd; background: white; border-radius: 4px;">Logout</button>
        </div>
    `;

    document.getElementById('logout-btn').onclick = () => {
        auth.logout();
        db = null;
        currentCollection = null;
        elements.authStatus.innerHTML = '';
        elements.authPanel.classList.remove('hidden');
        elements.repoPanel.classList.add('hidden');
        elements.operationsPanel.classList.add('hidden');
        showLoginButton();
        log('Logged out', 'info');
    };

    // Hide auth panel, show repo selection
    elements.authPanel.classList.add('hidden');
    elements.repoPanel.classList.remove('hidden');

    // Pre-fill owner with authenticated user
    elements.owner.value = user.login;

    // Load saved repo preference
    const savedRepo = localStorage.getItem('gitdb_repo');
    const savedOwner = localStorage.getItem('gitdb_owner');
    const savedBranch = localStorage.getItem('gitdb_branch');

    if (savedRepo) elements.repo.value = savedRepo;
    if (savedOwner) elements.owner.value = savedOwner;
    if (savedBranch) elements.branch.value = savedBranch;
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Manual token connection
    elements.manualConnectBtn?.addEventListener('click', async () => {
        const token = elements.token.value.trim();
        if (!token) {
            log('Please enter a token', 'error');
            return;
        }

        try {
            // Manually save token and verify
            localStorage.setItem('gitdb_auth', JSON.stringify({
                access_token: token,
                created_at: Date.now()
            }));

            const user = await auth.getUser();
            onAuthenticated(user);
        } catch (error) {
            log(`Invalid token: ${error.message}`, 'error');
            localStorage.removeItem('gitdb_auth');
        }
    });

    // Connect to repository
    elements.connectRepoBtn?.addEventListener('click', connectToRepo);

    // Browse repos
    elements.pickRepoBtn?.addEventListener('click', async () => {
        if (!auth.isAuthenticated()) return log('Not authenticated', 'error');

        try {
            const repoName = await auth.showRepoPicker();
            elements.repo.value = repoName;
            elements.owner.value = auth.user.login;
            connectToRepo();
        } catch (error) {
            if (error.message !== 'Cancelled') {
                log(`Failed to pick repo: ${error.message}`, 'error');
            }
        }
    });

    // Tabs
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            elements.tabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Collections
    elements.initCollectionBtn?.addEventListener('click', initCollection);
    elements.loadCollectionBtn?.addEventListener('click', loadCollection);
    elements.createDocBtn?.addEventListener('click', createDocument);
    elements.readDocBtn?.addEventListener('click', readDocument);
    elements.updateDocBtn?.addEventListener('click', updateDocument);
    elements.deleteDocBtn?.addEventListener('click', deleteDocument);
    elements.refreshDocsBtn?.addEventListener('click', refreshDocumentsList);

    // Raw operations
    elements.rawGetBtn?.addEventListener('click', rawGet);
    elements.rawSetBtn?.addEventListener('click', rawSet);
    elements.rawDeleteBtn?.addEventListener('click', rawDelete);
    elements.rawListBtn?.addEventListener('click', rawList);

    // Query builder
    elements.addFilterBtn?.addEventListener('click', addFilter);
    elements.executeQueryBtn?.addEventListener('click', executeQuery);

    // History
    elements.getHistoryBtn?.addEventListener('click', getHistory);

    // Console
    elements.clearConsoleBtn?.addEventListener('click', () => {
        elements.console.innerHTML = '';
    });
}

// ============================================
// REPOSITORY CONNECTION
// ============================================

async function connectToRepo() {
    const owner = elements.owner.value.trim();
    const repo = elements.repo.value.trim();
    const branch = elements.branch.value.trim() || 'main';

    if (!owner || !repo) {
        log('Please enter owner and repository name', 'error');
        return;
    }

    try {
        log(`Connecting to ${owner}/${repo}...`, 'info');

        db = auth.createDB(owner, repo, { branch });

        // Test connection
        await db.list('');

        showStatus(`Connected to ${owner}/${repo}`, 'success');
        log(`Connected to ${owner}/${repo} (branch: ${branch})`, 'success');

        // Save preferences
        localStorage.setItem('gitdb_owner', owner);
        localStorage.setItem('gitdb_repo', repo);
        localStorage.setItem('gitdb_branch', branch);

        // Show operations panel
        elements.operationsPanel.classList.remove('hidden');

    } catch (error) {
        showStatus(`Connection failed: ${error.message}`, 'error');
        log(`Connection failed: ${error.message}`, 'error');
        db = null;
    }
}

function showStatus(message, type) {
    elements.connectionStatus.textContent = message;
    elements.connectionStatus.className = `status ${type}`;
}

// ============================================
// COLLECTION OPERATIONS
// ============================================

async function initCollection() {
    if (!db) return log('Not connected', 'error');

    const name = elements.collectionName.value.trim();
    if (!name) return log('Please enter a collection name', 'error');

    try {
        log(`Initializing collection: ${name}...`, 'info');
        const collection = db.collection(name);
        await collection.initialize();
        log(`Collection "${name}" initialized!`, 'success');
    } catch (error) {
        log(`Failed to initialize: ${error.message}`, 'error');
    }
}

async function loadCollection() {
    if (!db) return log('Not connected', 'error');

    const name = elements.collectionName.value.trim();
    if (!name) return log('Please enter a collection name', 'error');

    try {
        log(`Loading collection: ${name}...`, 'info');
        currentCollection = db.collection(name);

        const index = await currentCollection.getIndex();
        log(`Loaded collection with ${index.ids.length} documents`, 'success');

        elements.collectionActions.classList.remove('hidden');
        elements.currentCollectionSpan.textContent = name;

        await refreshDocumentsList();
    } catch (error) {
        log(`Failed to load: ${error.message}`, 'error');
    }
}

async function createDocument() {
    if (!currentCollection) return log('No collection loaded', 'error');

    const id = elements.docId.value.trim();
    const dataStr = elements.docData.value.trim();

    if (!id) return log('Please enter a document ID', 'error');
    if (!dataStr) return log('Please enter document data', 'error');

    try {
        const data = JSON.parse(dataStr);
        log(`Creating document: ${id}...`, 'info');

        const result = await currentCollection.create(id, data);
        log('Document created!', 'success', result);

        await refreshDocumentsList();
    } catch (error) {
        log(`Failed to create: ${error.message}`, 'error');
    }
}

async function readDocument() {
    if (!currentCollection) return log('No collection loaded', 'error');

    const id = elements.docId.value.trim();
    if (!id) return log('Please enter a document ID', 'error');

    try {
        log(`Reading document: ${id}...`, 'info');
        const data = await currentCollection.read(id);

        if (data) {
            log('Document found:', 'success', data);
            elements.docData.value = JSON.stringify(data, null, 2);
        } else {
            log('Document not found', 'error');
        }
    } catch (error) {
        log(`Failed to read: ${error.message}`, 'error');
    }
}

async function updateDocument() {
    if (!currentCollection) return log('No collection loaded', 'error');

    const id = elements.docId.value.trim();
    const dataStr = elements.docData.value.trim();

    if (!id) return log('Please enter a document ID', 'error');
    if (!dataStr) return log('Please enter document data', 'error');

    try {
        const data = JSON.parse(dataStr);
        log(`Updating document: ${id}...`, 'info');

        const result = await currentCollection.update(id, data);
        log('Document updated!', 'success', result);

        await refreshDocumentsList();
    } catch (error) {
        log(`Failed to update: ${error.message}`, 'error');
    }
}

async function deleteDocument() {
    if (!currentCollection) return log('No collection loaded', 'error');

    const id = elements.docId.value.trim();
    if (!id) return log('Please enter a document ID', 'error');

    if (!confirm(`Are you sure you want to delete "${id}"?`)) return;

    try {
        log(`Deleting document: ${id}...`, 'info');
        await currentCollection.delete(id);
        log('Document deleted!', 'success');

        elements.docId.value = '';
        elements.docData.value = '';

        await refreshDocumentsList();
    } catch (error) {
        log(`Failed to delete: ${error.message}`, 'error');
    }
}

async function refreshDocumentsList() {
    if (!currentCollection) return;

    try {
        const docs = await currentCollection.getAll();
        elements.documentsList.innerHTML = '';

        if (docs.length === 0) {
            elements.documentsList.innerHTML = '<div class="document-item">No documents found</div>';
            return;
        }

        docs.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'document-item';

            const preview = JSON.stringify(doc).substring(0, 100);

            item.innerHTML = `
                <div class="doc-id">${escapeHtml(doc._id || 'unknown')}</div>
                <div class="doc-preview">${escapeHtml(preview)}...</div>
            `;

            item.addEventListener('click', () => {
                elements.docId.value = doc._id;
                elements.docData.value = JSON.stringify(doc, null, 2);
            });

            elements.documentsList.appendChild(item);
        });
    } catch (error) {
        log(`Failed to refresh: ${error.message}`, 'error');
    }
}

// ============================================
// RAW OPERATIONS
// ============================================

async function rawGet() {
    if (!db) return log('Not connected', 'error');

    const path = elements.rawPath.value.trim();
    if (!path) return log('Please enter a file path', 'error');

    try {
        log(`GET ${path}...`, 'info');
        const data = await db.get(path);

        if (data !== null) {
            log('Data retrieved:', 'success', data);
            elements.rawContent.value = JSON.stringify(data, null, 2);
        } else {
            log('File not found', 'error');
        }
    } catch (error) {
        log(`GET failed: ${error.message}`, 'error');
    }
}

async function rawSet() {
    if (!db) return log('Not connected', 'error');

    const path = elements.rawPath.value.trim();
    const contentStr = elements.rawContent.value.trim();

    if (!path) return log('Please enter a file path', 'error');
    if (!contentStr) return log('Please enter content', 'error');

    try {
        const content = JSON.parse(contentStr);
        log(`SET ${path}...`, 'info');

        await db.set(path, content);
        log('Data saved!', 'success');
    } catch (error) {
        log(`SET failed: ${error.message}`, 'error');
    }
}

async function rawDelete() {
    if (!db) return log('Not connected', 'error');

    const path = elements.rawPath.value.trim();
    if (!path) return log('Please enter a file path', 'error');

    if (!confirm(`Are you sure you want to delete "${path}"?`)) return;

    try {
        log(`DELETE ${path}...`, 'info');
        await db.delete(path);
        log('File deleted!', 'success');
        elements.rawContent.value = '';
    } catch (error) {
        log(`DELETE failed: ${error.message}`, 'error');
    }
}

async function rawList() {
    if (!db) return log('Not connected', 'error');

    const path = elements.rawPath.value.trim();

    try {
        log(`LIST ${path || '/'}...`, 'info');
        const items = await db.list(path);

        const names = items.map(item =>
            `${item.type === 'dir' ? '[DIR]' : '[FILE]'} ${item.name}`
        );

        log('Contents:', 'success', names.join('\n'));
    } catch (error) {
        log(`LIST failed: ${error.message}`, 'error');
    }
}

// ============================================
// QUERY BUILDER
// ============================================

function addFilter() {
    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.innerHTML = `
        <input type="text" class="filter-field" placeholder="field">
        <select class="filter-operator">
            <option value="==">=</option>
            <option value="!=">!=</option>
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value=">=">&gt;=</option>
            <option value="<=">&lt;=</option>
            <option value="contains">contains</option>
            <option value="startsWith">starts with</option>
            <option value="endsWith">ends with</option>
        </select>
        <input type="text" class="filter-value" placeholder="value">
        <button class="btn small danger" onclick="this.parentElement.remove()">X</button>
    `;
    elements.queryFilters.appendChild(filterRow);
}

async function executeQuery() {
    if (!db) return log('Not connected', 'error');

    const collectionName = elements.queryCollection.value.trim();
    if (!collectionName) return log('Please enter a collection name', 'error');

    try {
        log(`Executing query on ${collectionName}...`, 'info');

        const collection = db.collection(collectionName);
        let query = collection.query();

        // Add filters
        const filterRows = elements.queryFilters.querySelectorAll('.filter-row');
        filterRows.forEach(row => {
            const field = row.querySelector('.filter-field').value.trim();
            const operator = row.querySelector('.filter-operator').value;
            let value = row.querySelector('.filter-value').value.trim();

            if (field && value) {
                // Try to parse as number or boolean
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (!isNaN(value) && value !== '') value = Number(value);

                query = query.where(field, operator, value);
            }
        });

        // Add sorting
        const sortField = elements.querySort.value.trim();
        if (sortField) {
            query = query.orderBy(sortField, elements.queryOrder.value);
        }

        // Add limit
        const limit = elements.queryLimit.value.trim();
        if (limit) {
            query = query.limit(parseInt(limit, 10));
        }

        const results = await query.execute();
        log(`Found ${results.length} results`, 'success');

        elements.queryResults.innerHTML = `<pre>${escapeHtml(JSON.stringify(results, null, 2))}</pre>`;
    } catch (error) {
        log(`Query failed: ${error.message}`, 'error');
    }
}

// ============================================
// HISTORY
// ============================================

async function getHistory() {
    if (!db) return log('Not connected', 'error');

    const path = elements.historyPath.value.trim();
    if (!path) return log('Please enter a file path', 'error');

    try {
        log(`Getting history for ${path}...`, 'info');
        const history = await db.getHistory(path);

        elements.historyList.innerHTML = '';

        if (history.length === 0) {
            elements.historyList.innerHTML = '<div class="history-item">No history found</div>';
            return;
        }

        log(`Found ${history.length} commits`, 'success');

        history.forEach(commit => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="commit-sha">${commit.sha.substring(0, 7)}</div>
                <div class="commit-message">${escapeHtml(commit.commit.message)}</div>
                <div class="commit-author">${escapeHtml(commit.commit.author.name)} - ${new Date(commit.commit.author.date).toLocaleString()}</div>
            `;

            item.addEventListener('click', async () => {
                try {
                    log(`Loading version at ${commit.sha.substring(0, 7)}...`, 'info');
                    const data = await db.getAtCommit(path, commit.sha);
                    log('Historical data:', 'success', data);
                } catch (error) {
                    log(`Failed to load: ${error.message}`, 'error');
                }
            });

            elements.historyList.appendChild(item);
        });
    } catch (error) {
        log(`Failed to get history: ${error.message}`, 'error');
    }
}

// ============================================
// START
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
