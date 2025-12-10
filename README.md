# GitDB - GitHub as a Live Database

A client-side JavaScript library that transforms GitHub repositories into fully functional databases. Perfect for static sites, GitHub Pages, and serverless applications.

## Features

- **No Backend Required** - Pure client-side, works with GitHub Pages
- **Free Storage** - Uses GitHub's free tier (unlimited public repos)
- **Version Control** - Full Git history for all data changes
- **Time Travel** - Revert to any previous state
- **Branches** - Use branches for dev/staging/prod environments
- **Query Builder** - Filter, sort, and paginate data
- **Schema Validation** - Validate data before saving
- **Real-time Sync** - Poll for changes with customizable intervals

## Quick Start

### 1. Include the Library

```html
<script src="js/gitdb.js"></script>
```

Or install via npm:

```bash
npm install gitdb
```

### 2. Initialize Database

```javascript
const db = new GitDB({
    owner: 'your-username',
    repo: 'your-database-repo',
    token: 'ghp_your_token_here',
    branch: 'main'  // optional, defaults to 'main'
});
```

### 3. CRUD Operations

```javascript
// Get a collection
const users = db.collection('users');

// Create
await users.create('user_001', {
    name: 'John Doe',
    email: 'john@example.com'
});

// Read
const user = await users.read('user_001');

// Update (merge)
await users.update('user_001', { age: 30 });

// Delete
await users.delete('user_001');

// Get all documents
const allUsers = await users.getAll();
```

## API Reference

### GitDB Class

#### Constructor

```javascript
new GitDB({
    owner: string,      // GitHub username or organization
    repo: string,       // Repository name
    token: string,      // Personal access token
    branch?: string,    // Branch name (default: 'main')
    cacheTTL?: number   // Cache TTL in ms (default: 60000)
})
```

#### Core Methods

| Method | Description |
|--------|-------------|
| `get(path)` | Get JSON content at path |
| `set(path, data, message?)` | Set JSON content at path |
| `delete(path, message?)` | Delete file at path |
| `list(path)` | List directory contents |
| `exists(path)` | Check if path exists |
| `collection(name)` | Get a Collection interface |

#### Query Methods

```javascript
// Simple query with filter
const results = await db.query('users', { role: 'admin' });
```

#### Transaction

```javascript
await db.transaction([
    { type: 'create', path: 'data/users/user_001.json', data: {...} },
    { type: 'update', path: 'data/config.json', data: {...} },
    { type: 'delete', path: 'data/temp.json' }
]);
```

#### Real-time Sync

```javascript
// Watch single path
const unwatch = db.watch('data/config.json', (data, sha) => {
    console.log('Config changed:', data);
}, 5000);

// Stop watching
unwatch();

// Watch multiple paths
const unwatchAll = db.watchAll(
    ['data/users/index.json', 'data/posts/index.json'],
    (path, data, sha) => console.log(`${path} changed:`, data),
    5000
);
```

#### History

```javascript
// Get commit history
const history = await db.getHistory('data/users/user_001.json', 10);

// Get content at specific commit
const oldData = await db.getAtCommit('data/users/user_001.json', 'abc123');
```

### Collection Class

#### Methods

| Method | Description |
|--------|-------------|
| `create(id, data)` | Create new document |
| `read(id)` | Read document by ID |
| `update(id, data)` | Merge update document |
| `replace(id, data)` | Replace entire document |
| `delete(id)` | Delete document |
| `getAll()` | Get all documents |
| `count()` | Get document count |
| `find(filter)` | Find documents matching filter |
| `findOne(filter)` | Find first matching document |
| `query()` | Get QueryBuilder |
| `initialize()` | Create collection index if missing |

### QueryBuilder Class

```javascript
const results = await db.collection('posts')
    .query()
    .where('published', '==', true)
    .where('views', '>', 100)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .skip(0)
    .select(['title', 'author', 'views'])
    .execute();
```

#### Filter Operators

| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater than or equal |
| `<=` | Less than or equal |
| `contains` | String/array contains |
| `startsWith` | String starts with |
| `endsWith` | String ends with |
| `in` | Value in array |
| `not-in` | Value not in array |
| `matches` | Regex match |

### Schema Validation

```javascript
const userSchema = new Schema({
    name: { type: 'string', required: true, minLength: 1 },
    email: { type: 'string', required: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
    age: { type: 'number', min: 0, max: 150 },
    role: { type: 'string', enum: ['user', 'admin'] }
});

const result = userSchema.validate(userData);
// { valid: true, errors: [] }
```

## Repository Structure

```
your-database-repo/
├── data/
│   ├── collections/
│   │   ├── users/
│   │   │   ├── index.json        # {"ids": ["user_001", "user_002"]}
│   │   │   ├── user_001.json
│   │   │   └── user_002.json
│   │   ├── posts/
│   │   │   ├── index.json
│   │   │   └── ...
│   │   └── comments/
│   │       └── index.json
│   ├── schemas/
│   │   ├── user.json
│   │   └── post.json
│   └── config.json
└── README.md
```

## Setup Guide

### 1. Create Database Repository

```bash
# Create a new repository on GitHub
gh repo create my-database --public

# Clone and initialize
git clone https://github.com/username/my-database
cd my-database

# Create structure
mkdir -p data/collections/{users,posts,comments}
mkdir -p data/schemas

# Initialize collections
echo '{"ids":[],"createdAt":"'$(date -Iseconds)'"}' > data/collections/users/index.json
echo '{"ids":[],"createdAt":"'$(date -Iseconds)'"}' > data/collections/posts/index.json
echo '{"ids":[],"createdAt":"'$(date -Iseconds)'"}' > data/collections/comments/index.json

# Add config
cat > data/config.json << 'EOF'
{
  "version": "1.0.0",
  "name": "My Database",
  "collections": ["users", "posts", "comments"]
}
EOF

# Commit and push
git add .
git commit -m "Initialize database structure"
git push
```

### 2. Create Personal Access Token

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Click "Generate new token (classic)"
3. Select scope: `repo` (Full control of private repositories)
4. Copy the token

### 3. Use in Your App

```html
<!DOCTYPE html>
<html>
<head>
    <title>My App</title>
</head>
<body>
    <script src="gitdb.js"></script>
    <script>
        const db = new GitDB({
            owner: 'your-username',
            repo: 'my-database',
            token: 'ghp_your_token'
        });

        // Your app code here
    </script>
</body>
</html>
```

## Examples

### Blog with Comments

```javascript
// Create a post
const posts = db.collection('posts');
await posts.create('hello-world', {
    title: 'Hello World',
    content: 'My first post!',
    author: 'john',
    published: true,
    tags: ['intro', 'welcome']
});

// Add a comment
const comments = db.collection('comments');
await comments.create('comment_' + Date.now(), {
    postId: 'hello-world',
    author: 'jane',
    text: 'Great post!',
    likes: 0
});

// Get comments for a post
const postComments = await comments.query()
    .where('postId', '==', 'hello-world')
    .orderBy('_createdAt', 'asc')
    .execute();
```

### Form Submissions

```javascript
document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submissions = db.collection('submissions');
    await submissions.create('sub_' + Date.now(), {
        name: e.target.name.value,
        email: e.target.email.value,
        message: e.target.message.value
    });

    alert('Thanks for your submission!');
});
```

### Feature Flags

```javascript
async function isFeatureEnabled(feature) {
    const config = await db.get('data/config.json');
    return config.features?.[feature] === true;
}

if (await isFeatureEnabled('darkMode')) {
    enableDarkMode();
}
```

## Performance Tips

1. **Use Caching** - Default 60s TTL reduces API calls
2. **Batch Reads** - Use `getAll()` then filter client-side for small collections
3. **Index Files** - Keep index.json files updated for fast lookups
4. **Pagination** - Use `limit()` and `skip()` for large datasets

## Limitations

| Constraint | Limit |
|------------|-------|
| API Rate (authenticated) | 5,000 requests/hour |
| API Rate (unauthenticated) | 60 requests/hour |
| File Size | 100 MB max |
| Repository Size | ~5 GB recommended |
| Write Latency | ~1-2 seconds |

## Security Considerations

- **Never expose tokens** in client-side code for production
- Use GitHub Actions or serverless functions as a proxy
- Consider using fine-grained personal access tokens
- Enable branch protection for critical data

## License

MIT
