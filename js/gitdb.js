/**
 * GitDB - GitHub as a Live Database
 *
 * A client-side database that uses GitHub repositories as the storage backend.
 * Uses the GitHub Contents API to perform CRUD operations.
 *
 * @version 1.0.0
 * @license MIT
 */

// ============================================
// GITDB CORE CLASS
// ============================================

class GitDB {
    /**
     * Create a new GitDB instance
     * @param {Object} config - Configuration object
     * @param {string} config.owner - GitHub username or organization
     * @param {string} config.repo - Repository name
     * @param {string} config.token - GitHub personal access token
     * @param {string} [config.branch='main'] - Branch to use
     * @param {number} [config.cacheTTL=60000] - Cache TTL in milliseconds
     */
    constructor(config) {
        if (!config.owner || !config.repo || !config.token) {
            throw new Error('GitDB requires owner, repo, and token');
        }

        this.owner = config.owner;
        this.repo = config.repo;
        this.token = config.token;
        this.branch = config.branch || 'main';
        this.baseURL = 'https://api.github.com';
        this.cacheTTL = config.cacheTTL || 60000;
        this._cache = new Map();
        this._watchers = new Map();
    }

    // ============================================
    // CORE OPERATIONS
    // ============================================

    /**
     * Get content from a path (with caching)
     * @param {string} path - File path in repository
     * @param {boolean} [useCache=true] - Whether to use cache
     * @returns {Promise<Object|null>} Parsed JSON content or null if not found
     */
    async get(path, useCache = true) {
        // Check cache first
        if (useCache) {
            const cached = this._cache.get(path);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }

        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;

        try {
            const response = await fetch(url, {
                headers: this._headers()
            });

            if (!response.ok) {
                if (response.status === 404) return null;
                const error = await response.json();
                throw new Error(`GET failed: ${error.message || response.statusText}`);
            }

            const data = await response.json();
            const content = this._decodeContent(data.content);
            const parsed = JSON.parse(content);

            // Update cache
            this._cache.set(path, { data: parsed, timestamp: Date.now(), sha: data.sha });

            return parsed;
        } catch (error) {
            if (error.message.includes('404')) return null;
            throw error;
        }
    }

    /**
     * Set content at a path
     * @param {string} path - File path in repository
     * @param {Object} data - Data to store (will be JSON stringified)
     * @param {string} [message] - Commit message
     * @returns {Promise<Object>} GitHub API response
     */
    async set(path, data, message) {
        const content = this._encodeContent(JSON.stringify(data, null, 2));

        // Get current file SHA (required for updates)
        let sha = null;
        const cached = this._cache.get(path);
        if (cached && cached.sha) {
            sha = cached.sha;
        } else {
            try {
                const existing = await this._getRaw(path);
                sha = existing.sha;
            } catch (e) {
                // File doesn't exist, that's ok for creation
            }
        }

        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}`;
        const body = {
            message: message || `Update ${path}`,
            content: content,
            branch: this.branch
        };

        if (sha) {
            body.sha = sha;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: this._headers(),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`SET failed: ${error.message || response.statusText}`);
        }

        const result = await response.json();

        // Update cache with new SHA
        this._cache.set(path, {
            data: data,
            timestamp: Date.now(),
            sha: result.content.sha
        });

        return result;
    }

    /**
     * Delete content at a path
     * @param {string} path - File path in repository
     * @param {string} [message] - Commit message
     * @returns {Promise<Object>} GitHub API response
     */
    async delete(path, message) {
        const existing = await this._getRaw(path);

        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: this._headers(),
            body: JSON.stringify({
                message: message || `Delete ${path}`,
                sha: existing.sha,
                branch: this.branch
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`DELETE failed: ${error.message || response.statusText}`);
        }

        // Remove from cache
        this._cache.delete(path);

        return await response.json();
    }

    /**
     * List contents of a directory
     * @param {string} path - Directory path
     * @returns {Promise<Array>} Array of file/directory objects
     */
    async list(path) {
        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;

        const response = await fetch(url, {
            headers: this._headers()
        });

        if (!response.ok) {
            if (response.status === 404) return [];
            const error = await response.json();
            throw new Error(`LIST failed: ${error.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Check if a path exists
     * @param {string} path - Path to check
     * @returns {Promise<boolean>}
     */
    async exists(path) {
        try {
            await this._getRaw(path);
            return true;
        } catch {
            return false;
        }
    }

    // ============================================
    // COLLECTION OPERATIONS
    // ============================================

    /**
     * Get a collection interface
     * @param {string} name - Collection name
     * @returns {Collection}
     */
    collection(name) {
        return new Collection(this, name);
    }

    // ============================================
    // QUERY OPERATIONS
    // ============================================

    /**
     * Query a collection with filters
     * @param {string} collectionName - Collection to query
     * @param {Object} [filter] - Simple key-value filter
     * @returns {Promise<Array>} Filtered results
     */
    async query(collectionName, filter) {
        const items = await this.collection(collectionName).getAll();

        if (!filter) return items;

        return items.filter(item => {
            for (let [key, value] of Object.entries(filter)) {
                if (item[key] !== value) return false;
            }
            return true;
        });
    }

    // ============================================
    // TRANSACTION OPERATIONS
    // ============================================

    /**
     * Execute multiple operations atomically using Git tree API
     * @param {Array<Object>} operations - Array of operations
     * @returns {Promise<Object>} Transaction result
     */
    async transaction(operations) {
        // Get the current commit SHA
        const refUrl = `${this.baseURL}/repos/${this.owner}/${this.repo}/git/ref/heads/${this.branch}`;
        const refResponse = await fetch(refUrl, { headers: this._headers() });
        const refData = await refResponse.json();
        const baseCommitSha = refData.object.sha;

        // Get the tree SHA
        const commitUrl = `${this.baseURL}/repos/${this.owner}/${this.repo}/git/commits/${baseCommitSha}`;
        const commitResponse = await fetch(commitUrl, { headers: this._headers() });
        const commitData = await commitResponse.json();
        const baseTreeSha = commitData.tree.sha;

        // Build tree entries for all operations
        const treeEntries = [];

        for (const op of operations) {
            if (op.type === 'delete') {
                // For delete, we don't include the file in the tree
                // GitHub will handle this by creating a tree without this file
                treeEntries.push({
                    path: op.path,
                    mode: '100644',
                    type: 'blob',
                    sha: null // null SHA deletes the file
                });
            } else {
                // For create/update, create a blob first
                const blobUrl = `${this.baseURL}/repos/${this.owner}/${this.repo}/git/blobs`;
                const blobResponse = await fetch(blobUrl, {
                    method: 'POST',
                    headers: this._headers(),
                    body: JSON.stringify({
                        content: JSON.stringify(op.data, null, 2),
                        encoding: 'utf-8'
                    })
                });
                const blobData = await blobResponse.json();

                treeEntries.push({
                    path: op.path,
                    mode: '100644',
                    type: 'blob',
                    sha: blobData.sha
                });
            }
        }

        // Create new tree
        const treeUrl = `${this.baseURL}/repos/${this.owner}/${this.repo}/git/trees`;
        const treeResponse = await fetch(treeUrl, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeEntries
            })
        });
        const newTree = await treeResponse.json();

        // Create commit
        const newCommitUrl = `${this.baseURL}/repos/${this.owner}/${this.repo}/git/commits`;
        const newCommitResponse = await fetch(newCommitUrl, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({
                message: operations[0].message || `Transaction: ${operations.length} operations`,
                tree: newTree.sha,
                parents: [baseCommitSha]
            })
        });
        const newCommit = await newCommitResponse.json();

        // Update ref
        const updateRefUrl = `${this.baseURL}/repos/${this.owner}/${this.repo}/git/refs/heads/${this.branch}`;
        await fetch(updateRefUrl, {
            method: 'PATCH',
            headers: this._headers(),
            body: JSON.stringify({
                sha: newCommit.sha
            })
        });

        // Clear cache for affected paths
        for (const op of operations) {
            this._cache.delete(op.path);
        }

        return {
            success: true,
            commit: newCommit.sha,
            operations: operations.length
        };
    }

    // ============================================
    // REAL-TIME SYNC
    // ============================================

    /**
     * Watch a path for changes
     * @param {string} path - Path to watch
     * @param {Function} callback - Called when content changes
     * @param {number} [interval=5000] - Polling interval in ms
     * @returns {Function} Unwatch function
     */
    watch(path, callback, interval = 5000) {
        let lastSHA = null;
        let active = true;

        const poll = async () => {
            if (!active) return;

            try {
                const data = await this._getRaw(path);
                if (data.sha !== lastSHA) {
                    lastSHA = data.sha;
                    const content = JSON.parse(this._decodeContent(data.content));
                    callback(content, data.sha);
                }
            } catch (error) {
                console.error('Watch error:', error);
            }

            if (active) {
                setTimeout(poll, interval);
            }
        };

        // Start polling
        poll();

        // Return unwatch function
        return () => {
            active = false;
        };
    }

    /**
     * Watch multiple paths
     * @param {Array<string>} paths - Paths to watch
     * @param {Function} callback - Called with path and new content
     * @param {number} [interval=5000] - Polling interval
     * @returns {Function} Unwatch function
     */
    watchAll(paths, callback, interval = 5000) {
        const unwatchers = paths.map(path =>
            this.watch(path, (content, sha) => callback(path, content, sha), interval)
        );

        return () => unwatchers.forEach(unwatch => unwatch());
    }

    // ============================================
    // HISTORY & VERSIONING
    // ============================================

    /**
     * Get commit history for a path
     * @param {string} path - File path
     * @param {number} [limit=10] - Max commits to return
     * @returns {Promise<Array>} Array of commits
     */
    async getHistory(path, limit = 10) {
        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/commits?path=${path}&per_page=${limit}`;

        const response = await fetch(url, {
            headers: this._headers()
        });

        if (!response.ok) {
            throw new Error('Failed to get history');
        }

        return await response.json();
    }

    /**
     * Get content at a specific commit
     * @param {string} path - File path
     * @param {string} sha - Commit SHA
     * @returns {Promise<Object>} Content at that commit
     */
    async getAtCommit(path, sha) {
        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${sha}`;

        const response = await fetch(url, {
            headers: this._headers()
        });

        if (!response.ok) {
            throw new Error('Failed to get content at commit');
        }

        const data = await response.json();
        return JSON.parse(this._decodeContent(data.content));
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    async _getRaw(path) {
        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;

        const response = await fetch(url, {
            headers: this._headers()
        });

        if (!response.ok) {
            throw new Error(`GET RAW failed: ${response.status}`);
        }

        return await response.json();
    }

    _headers() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
    }

    _encodeContent(content) {
        // Base64 encode for GitHub API
        if (typeof btoa !== 'undefined') {
            return btoa(unescape(encodeURIComponent(content)));
        }
        // Node.js environment
        return Buffer.from(content, 'utf-8').toString('base64');
    }

    _decodeContent(content) {
        // Base64 decode from GitHub API
        if (typeof atob !== 'undefined') {
            return decodeURIComponent(escape(atob(content)));
        }
        // Node.js environment
        return Buffer.from(content, 'base64').toString('utf-8');
    }

    /**
     * Clear the cache
     * @param {string} [path] - Specific path to clear, or all if not specified
     */
    clearCache(path) {
        if (path) {
            this._cache.delete(path);
        } else {
            this._cache.clear();
        }
    }
}

// ============================================
// COLLECTION CLASS
// ============================================

class Collection {
    /**
     * Create a Collection interface
     * @param {GitDB} db - GitDB instance
     * @param {string} name - Collection name
     */
    constructor(db, name) {
        this.db = db;
        this.name = name;
        this.basePath = `data/collections/${name}`;
    }

    /**
     * Create a new document
     * @param {string} id - Document ID
     * @param {Object} data - Document data
     * @returns {Promise<Object>} Created document
     */
    async create(id, data) {
        // Check if document already exists
        const existing = await this.read(id);
        if (existing) {
            throw new Error(`Document ${id} already exists`);
        }

        const path = `${this.basePath}/${id}.json`;
        const docData = {
            ...data,
            _id: id,
            _createdAt: new Date().toISOString(),
            _updatedAt: new Date().toISOString()
        };

        await this.db.set(path, docData, `Create ${this.name}/${id}`);
        await this._updateIndex('add', id);

        return docData;
    }

    /**
     * Read a document
     * @param {string} id - Document ID
     * @returns {Promise<Object|null>} Document or null
     */
    async read(id) {
        const path = `${this.basePath}/${id}.json`;
        return await this.db.get(path);
    }

    /**
     * Update a document (merge)
     * @param {string} id - Document ID
     * @param {Object} data - Data to merge
     * @returns {Promise<Object>} Updated document
     */
    async update(id, data) {
        const existing = await this.read(id);
        if (!existing) {
            throw new Error(`Document ${id} not found`);
        }

        const path = `${this.basePath}/${id}.json`;
        const docData = {
            ...existing,
            ...data,
            _id: id,
            _updatedAt: new Date().toISOString()
        };

        await this.db.set(path, docData, `Update ${this.name}/${id}`);

        return docData;
    }

    /**
     * Replace a document completely
     * @param {string} id - Document ID
     * @param {Object} data - New document data
     * @returns {Promise<Object>} New document
     */
    async replace(id, data) {
        const existing = await this.read(id);
        const path = `${this.basePath}/${id}.json`;

        const docData = {
            ...data,
            _id: id,
            _createdAt: existing?._createdAt || new Date().toISOString(),
            _updatedAt: new Date().toISOString()
        };

        await this.db.set(path, docData, `Replace ${this.name}/${id}`);

        if (!existing) {
            await this._updateIndex('add', id);
        }

        return docData;
    }

    /**
     * Delete a document
     * @param {string} id - Document ID
     * @returns {Promise<Object>} Deletion result
     */
    async delete(id) {
        const path = `${this.basePath}/${id}.json`;
        await this.db.delete(path, `Delete ${this.name}/${id}`);
        await this._updateIndex('remove', id);

        return { id, deleted: true };
    }

    /**
     * Get all documents
     * @returns {Promise<Array>} All documents
     */
    async getAll() {
        const index = await this.getIndex();
        const items = [];

        // Fetch all documents in parallel for better performance
        const promises = index.ids.map(id => this.read(id));
        const results = await Promise.all(promises);

        for (let i = 0; i < results.length; i++) {
            if (results[i]) {
                items.push(results[i]);
            }
        }

        return items;
    }

    /**
     * Get document count
     * @returns {Promise<number>}
     */
    async count() {
        const index = await this.getIndex();
        return index.ids.length;
    }

    /**
     * Get collection index
     * @returns {Promise<Object>}
     */
    async getIndex() {
        const path = `${this.basePath}/index.json`;
        const index = await this.db.get(path);
        return index || { ids: [], updatedAt: null };
    }

    /**
     * Create a query builder
     * @returns {QueryBuilder}
     */
    query() {
        return new QueryBuilder(this);
    }

    /**
     * Find documents matching a filter
     * @param {Object} filter - Key-value filter
     * @returns {Promise<Array>}
     */
    async find(filter) {
        const items = await this.getAll();

        return items.filter(item => {
            for (let [key, value] of Object.entries(filter)) {
                if (item[key] !== value) return false;
            }
            return true;
        });
    }

    /**
     * Find one document matching a filter
     * @param {Object} filter - Key-value filter
     * @returns {Promise<Object|null>}
     */
    async findOne(filter) {
        const results = await this.find(filter);
        return results[0] || null;
    }

    /**
     * Update index file
     * @private
     */
    async _updateIndex(operation, id) {
        const index = await this.getIndex();

        if (operation === 'add' && !index.ids.includes(id)) {
            index.ids.push(id);
        } else if (operation === 'remove') {
            index.ids = index.ids.filter(existingId => existingId !== id);
        }

        index.updatedAt = new Date().toISOString();

        const path = `${this.basePath}/index.json`;
        await this.db.set(path, index, `Update ${this.name} index`);
    }

    /**
     * Initialize collection (create index if not exists)
     * @returns {Promise<void>}
     */
    async initialize() {
        const path = `${this.basePath}/index.json`;
        const exists = await this.db.exists(path);

        if (!exists) {
            await this.db.set(path, {
                ids: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, `Initialize ${this.name} collection`);
        }
    }
}

// ============================================
// QUERY BUILDER CLASS
// ============================================

class QueryBuilder {
    /**
     * Create a QueryBuilder
     * @param {Collection} collection - Collection to query
     */
    constructor(collection) {
        this.collection = collection;
        this._filters = [];
        this._sortField = null;
        this._sortOrder = 'asc';
        this._limitCount = null;
        this._skipCount = 0;
        this._selectFields = null;
    }

    /**
     * Add a filter condition
     * @param {string} field - Field name
     * @param {string} operator - Comparison operator
     * @param {*} value - Value to compare
     * @returns {QueryBuilder}
     */
    where(field, operator, value) {
        this._filters.push({ field, operator, value });
        return this;
    }

    /**
     * Add equality filter (shorthand)
     * @param {string} field - Field name
     * @param {*} value - Value to equal
     * @returns {QueryBuilder}
     */
    equals(field, value) {
        return this.where(field, '==', value);
    }

    /**
     * Set sort order
     * @param {string} field - Field to sort by
     * @param {string} [order='asc'] - 'asc' or 'desc'
     * @returns {QueryBuilder}
     */
    orderBy(field, order = 'asc') {
        this._sortField = field;
        this._sortOrder = order;
        return this;
    }

    /**
     * Limit results
     * @param {number} count - Max results
     * @returns {QueryBuilder}
     */
    limit(count) {
        this._limitCount = count;
        return this;
    }

    /**
     * Skip results (for pagination)
     * @param {number} count - Results to skip
     * @returns {QueryBuilder}
     */
    skip(count) {
        this._skipCount = count;
        return this;
    }

    /**
     * Select specific fields
     * @param {Array<string>} fields - Fields to include
     * @returns {QueryBuilder}
     */
    select(fields) {
        this._selectFields = fields;
        return this;
    }

    /**
     * Execute the query
     * @returns {Promise<Array>}
     */
    async execute() {
        let items = await this.collection.getAll();

        // Apply filters
        for (let filter of this._filters) {
            items = items.filter(item => {
                const value = this._getNestedValue(item, filter.field);
                return this._compare(value, filter.operator, filter.value);
            });
        }

        // Apply sorting
        if (this._sortField) {
            items.sort((a, b) => {
                const aVal = this._getNestedValue(a, this._sortField);
                const bVal = this._getNestedValue(b, this._sortField);

                let comparison;
                if (aVal === null || aVal === undefined) comparison = 1;
                else if (bVal === null || bVal === undefined) comparison = -1;
                else if (typeof aVal === 'string') comparison = aVal.localeCompare(bVal);
                else comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;

                return this._sortOrder === 'asc' ? comparison : -comparison;
            });
        }

        // Apply skip
        if (this._skipCount > 0) {
            items = items.slice(this._skipCount);
        }

        // Apply limit
        if (this._limitCount !== null) {
            items = items.slice(0, this._limitCount);
        }

        // Apply field selection
        if (this._selectFields) {
            items = items.map(item => {
                const selected = {};
                for (let field of this._selectFields) {
                    selected[field] = this._getNestedValue(item, field);
                }
                return selected;
            });
        }

        return items;
    }

    /**
     * Get first result
     * @returns {Promise<Object|null>}
     */
    async first() {
        this._limitCount = 1;
        const results = await this.execute();
        return results[0] || null;
    }

    /**
     * Get result count
     * @returns {Promise<number>}
     */
    async count() {
        const results = await this.execute();
        return results.length;
    }

    /**
     * Check if any results exist
     * @returns {Promise<boolean>}
     */
    async exists() {
        const count = await this.count();
        return count > 0;
    }

    /**
     * Compare values using operator
     * @private
     */
    _compare(value, operator, target) {
        switch (operator) {
            case '==':
            case '===':
                return value === target;
            case '!=':
            case '!==':
                return value !== target;
            case '>':
                return value > target;
            case '<':
                return value < target;
            case '>=':
                return value >= target;
            case '<=':
                return value <= target;
            case 'contains':
                return Array.isArray(value)
                    ? value.includes(target)
                    : String(value).includes(target);
            case 'startsWith':
                return String(value).startsWith(target);
            case 'endsWith':
                return String(value).endsWith(target);
            case 'in':
                return Array.isArray(target) && target.includes(value);
            case 'not-in':
                return Array.isArray(target) && !target.includes(value);
            case 'matches':
                return new RegExp(target).test(String(value));
            default:
                return false;
        }
    }

    /**
     * Get nested value from object using dot notation
     * @private
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) =>
            current && current[key] !== undefined ? current[key] : null, obj);
    }
}

// ============================================
// SCHEMA VALIDATION
// ============================================

class Schema {
    /**
     * Create a schema validator
     * @param {Object} definition - Schema definition
     */
    constructor(definition) {
        this.definition = definition;
    }

    /**
     * Validate data against schema
     * @param {Object} data - Data to validate
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validate(data) {
        const errors = [];

        for (let [field, rules] of Object.entries(this.definition)) {
            const value = data[field];

            // Required check
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`${field} is required`);
                continue;
            }

            if (value === undefined || value === null) continue;

            // Type check
            if (rules.type) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== rules.type) {
                    errors.push(`${field} must be of type ${rules.type}`);
                }
            }

            // Min length
            if (rules.minLength && value.length < rules.minLength) {
                errors.push(`${field} must be at least ${rules.minLength} characters`);
            }

            // Max length
            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push(`${field} must be at most ${rules.maxLength} characters`);
            }

            // Min value
            if (rules.min !== undefined && value < rules.min) {
                errors.push(`${field} must be at least ${rules.min}`);
            }

            // Max value
            if (rules.max !== undefined && value > rules.max) {
                errors.push(`${field} must be at most ${rules.max}`);
            }

            // Pattern
            if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
                errors.push(`${field} does not match required pattern`);
            }

            // Enum
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            }

            // Custom validator
            if (rules.validate && typeof rules.validate === 'function') {
                const result = rules.validate(value);
                if (result !== true) {
                    errors.push(result || `${field} is invalid`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Generate a unique ID
 * @param {string} [prefix=''] - Optional prefix
 * @returns {string}
 */
function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Debounce function for rate limiting
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function}
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// EXPORTS
// ============================================

// Browser global
if (typeof window !== 'undefined') {
    window.GitDB = GitDB;
    window.Collection = Collection;
    window.QueryBuilder = QueryBuilder;
    window.Schema = Schema;
    window.generateId = generateId;
}

// CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GitDB,
        Collection,
        QueryBuilder,
        Schema,
        generateId,
        debounce
    };
}

// ES Modules
if (typeof exports !== 'undefined') {
    exports.GitDB = GitDB;
    exports.Collection = Collection;
    exports.QueryBuilder = QueryBuilder;
    exports.Schema = Schema;
    exports.generateId = generateId;
    exports.debounce = debounce;
}
