/**
 * GitDB Demo Application
 * Interactive UI for testing GitDB operations
 */

// Global state
let db = null;
let currentCollection = null;

// DOM Elements
const elements = {
    // Config
    owner: document.getElementById('owner'),
    repo: document.getElementById('repo'),
    token: document.getElementById('token'),
    branch: document.getElementById('branch'),
    connectBtn: document.getElementById('connect-btn'),
    connectionStatus: document.getElementById('connection-status'),

    // Panels
    configPanel: document.getElementById('config-panel'),
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
// CONNECTION
// ============================================

elements.connectBtn.addEventListener('click', async () => {
    const owner = elements.owner.value.trim();
    const repo = elements.repo.value.trim();
    const token = elements.token.value.trim();
    const branch = elements.branch.value.trim() || 'main';

    if (!owner || !repo || !token) {
        showStatus('Please fill in all required fields', 'error');
        return;
    }

    try {
        log('Connecting to database...');

        db = new GitDB({ owner, repo, token, branch });

        // Test connection by listing root
        await db.list('');

        showStatus(`Connected to ${owner}/${repo}`, 'success');
        log('Connected successfully!', 'success');

        elements.operationsPanel.classList.remove('hidden');

        // Save to localStorage for convenience
        localStorage.setItem('gitdb_owner', owner);
        localStorage.setItem('gitdb_repo', repo);
        localStorage.setItem('gitdb_branch', branch);

    } catch (error) {
        showStatus(`Connection failed: ${error.message}`, 'error');
        log(`Connection failed: ${error.message}`, 'error');
        db = null;
    }
});

function showStatus(message, type) {
    elements.connectionStatus.textContent = message;
    elements.connectionStatus.className = `status ${type}`;
}

// Load saved config
window.addEventListener('load', () => {
    elements.owner.value = localStorage.getItem('gitdb_owner') || '';
    elements.repo.value = localStorage.getItem('gitdb_repo') || '';
    elements.branch.value = localStorage.getItem('gitdb_branch') || 'main';
});

// ============================================
// TABS
// ============================================

elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;

        elements.tabs.forEach(t => t.classList.remove('active'));
        elements.tabContents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// ============================================
// COLLECTIONS
// ============================================

elements.initCollectionBtn.addEventListener('click', async () => {
    if (!db) return log('Not connected', 'error');

    const name = elements.collectionName.value.trim();
    if (!name) return log('Please enter a collection name', 'error');

    try {
        log(`Initializing collection: ${name}...`);
        const collection = db.collection(name);
        await collection.initialize();
        log(`Collection "${name}" initialized!`, 'success');
    } catch (error) {
        log(`Failed to initialize: ${error.message}`, 'error');
    }
});

elements.loadCollectionBtn.addEventListener('click', async () => {
    if (!db) return log('Not connected', 'error');

    const name = elements.collectionName.value.trim();
    if (!name) return log('Please enter a collection name', 'error');

    try {
        log(`Loading collection: ${name}...`);
        currentCollection = db.collection(name);

        const index = await currentCollection.getIndex();
        log(`Loaded collection with ${index.ids.length} documents`, 'success');

        elements.collectionActions.classList.remove('hidden');
        elements.currentCollectionSpan.textContent = name;

        await refreshDocumentsList();
    } catch (error) {
        log(`Failed to load: ${error.message}`, 'error');
    }
});

elements.createDocBtn.addEventListener('click', async () => {
    if (!currentCollection) return log('No collection loaded', 'error');

    const id = elements.docId.value.trim();
    const dataStr = elements.docData.value.trim();

    if (!id) return log('Please enter a document ID', 'error');
    if (!dataStr) return log('Please enter document data', 'error');

    try {
        const data = JSON.parse(dataStr);
        log(`Creating document: ${id}...`);

        const result = await currentCollection.create(id, data);
        log('Document created!', 'success', result);

        await refreshDocumentsList();
    } catch (error) {
        log(`Failed to create: ${error.message}`, 'error');
    }
});

elements.readDocBtn.addEventListener('click', async () => {
    if (!currentCollection) return log('No collection loaded', 'error');

    const id = elements.docId.value.trim();
    if (!id) return log('Please enter a document ID', 'error');

    try {
        log(`Reading document: ${id}...`);
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
});

elements.updateDocBtn.addEventListener('click', async () => {
    if (!currentCollection) return log('No collection loaded', 'error');

    const id = elements.docId.value.trim();
    const dataStr = elements.docData.value.trim();

    if (!id) return log('Please enter a document ID', 'error');
    if (!dataStr) return log('Please enter document data', 'error');

    try {
        const data = JSON.parse(dataStr);
        log(`Updating document: ${id}...`);

        const result = await currentCollection.update(id, data);
        log('Document updated!', 'success', result);

        await refreshDocumentsList();
    } catch (error) {
        log(`Failed to update: ${error.message}`, 'error');
    }
});

elements.deleteDocBtn.addEventListener('click', async () => {
    if (!currentCollection) return log('No collection loaded', 'error');

    const id = elements.docId.value.trim();
    if (!id) return log('Please enter a document ID', 'error');

    if (!confirm(`Are you sure you want to delete "${id}"?`)) return;

    try {
        log(`Deleting document: ${id}...`);
        await currentCollection.delete(id);
        log('Document deleted!', 'success');

        elements.docId.value = '';
        elements.docData.value = '';

        await refreshDocumentsList();
    } catch (error) {
        log(`Failed to delete: ${error.message}`, 'error');
    }
});

elements.refreshDocsBtn.addEventListener('click', refreshDocumentsList);

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

elements.rawGetBtn.addEventListener('click', async () => {
    if (!db) return log('Not connected', 'error');

    const path = elements.rawPath.value.trim();
    if (!path) return log('Please enter a file path', 'error');

    try {
        log(`GET ${path}...`);
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
});

elements.rawSetBtn.addEventListener('click', async () => {
    if (!db) return log('Not connected', 'error');

    const path = elements.rawPath.value.trim();
    const contentStr = elements.rawContent.value.trim();

    if (!path) return log('Please enter a file path', 'error');
    if (!contentStr) return log('Please enter content', 'error');

    try {
        const content = JSON.parse(contentStr);
        log(`SET ${path}...`);

        await db.set(path, content);
        log('Data saved!', 'success');
    } catch (error) {
        log(`SET failed: ${error.message}`, 'error');
    }
});

elements.rawDeleteBtn.addEventListener('click', async () => {
    if (!db) return log('Not connected', 'error');

    const path = elements.rawPath.value.trim();
    if (!path) return log('Please enter a file path', 'error');

    if (!confirm(`Are you sure you want to delete "${path}"?`)) return;

    try {
        log(`DELETE ${path}...`);
        await db.delete(path);
        log('File deleted!', 'success');
        elements.rawContent.value = '';
    } catch (error) {
        log(`DELETE failed: ${error.message}`, 'error');
    }
});

elements.rawListBtn.addEventListener('click', async () => {
    if (!db) return log('Not connected', 'error');

    const path = elements.rawPath.value.trim();

    try {
        log(`LIST ${path || '/'}...`);
        const items = await db.list(path);

        const names = items.map(item =>
            `${item.type === 'dir' ? '[DIR]' : '[FILE]'} ${item.name}`
        );

        log('Contents:', 'success', names.join('\n'));
    } catch (error) {
        log(`LIST failed: ${error.message}`, 'error');
    }
});

// ============================================
// QUERY BUILDER
// ============================================

elements.addFilterBtn.addEventListener('click', () => {
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
});

elements.executeQueryBtn.addEventListener('click', async () => {
    if (!db) return log('Not connected', 'error');

    const collectionName = elements.queryCollection.value.trim();
    if (!collectionName) return log('Please enter a collection name', 'error');

    try {
        log(`Executing query on ${collectionName}...`);

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
});

// ============================================
// HISTORY
// ============================================

elements.getHistoryBtn.addEventListener('click', async () => {
    if (!db) return log('Not connected', 'error');

    const path = elements.historyPath.value.trim();
    if (!path) return log('Please enter a file path', 'error');

    try {
        log(`Getting history for ${path}...`);
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
                    log(`Loading version at ${commit.sha.substring(0, 7)}...`);
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
});

// ============================================
// CONSOLE
// ============================================

elements.clearConsoleBtn.addEventListener('click', () => {
    elements.console.innerHTML = '';
});

// Initial log
log('GitDB Demo loaded. Enter your GitHub credentials to connect.', 'info');
