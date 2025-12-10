# GitDB - GitHub as a Live Database

## Project Overview

GitDB is a client-side JavaScript library that transforms GitHub repositories into fully functional databases. It uses the GitHub Contents API to perform CRUD operations, making it perfect for static sites, GitHub Pages, and serverless applications.

## Architecture

```
GitDB System
├── js/gitdb.js        → Core database client (CRUD, queries, transactions)
├── js/gitdb-auth.js   → GitHub OAuth authentication (Device Flow)
├── js/app.js          → Demo application
├── data/              → Database storage (collections, schemas, config)
└── .claude/           → Claude Code extension for managing GitDB
```

## Key Concepts

- **Repository as Database**: A GitHub repo stores JSON documents as files
- **Collection**: A folder containing documents (e.g., `data/collections/users/`)
- **Document**: A JSON file representing a single record
- **Index**: Tracks document IDs for fast lookups (`index.json`)
- **Commit = Transaction**: Each write operation creates a Git commit

## Available Slash Commands

| Command | Description |
|---------|-------------|
| `/gitdb/init` | Initialize a new GitDB repository structure |
| `/gitdb/create` | Create a new document in a collection |
| `/gitdb/query` | Query documents with filters |
| `/gitdb/sync` | Sync local changes with remote |
| `/gitdb/backup` | Create a backup of the database |
| `/gitdb/migrate` | Run schema migrations |

## Important Files

- `js/gitdb.js` - Core library with GitDB, Collection, QueryBuilder classes
- `js/gitdb-auth.js` - OAuth authentication module
- `data/config.json` - Database configuration and feature flags
- `data/schemas/*.json` - JSON schemas for validation
- `data/collections/*/index.json` - Collection indexes

## Security Considerations

- Never commit GitHub tokens to the repository
- Use environment variables or `.claude/settings.local.json` for secrets
- The `repo` scope is required for full database access
- Consider using fine-grained personal access tokens

## Common Operations

### Initialize Database Structure
```bash
# Creates data/collections/{name}/index.json
/gitdb/init --collection users
```

### Create Document
```javascript
const db = new GitDB({ owner, repo, token });
const users = db.collection('users');
await users.create('user_001', { name: 'John', email: 'john@example.com' });
```

### Query Documents
```javascript
const results = await users.query()
    .where('role', '==', 'admin')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .execute();
```

## Environment Variables

```bash
GITHUB_TOKEN          # GitHub Personal Access Token
GITHUB_CLIENT_ID      # OAuth App Client ID (for Device Flow)
GITDB_OWNER          # Default repository owner
GITDB_REPO           # Default repository name
GITDB_BRANCH         # Default branch (main)
```

## GitHub Pages Deployment

1. Enable GitHub Pages in repository settings
2. Set source to `main` branch, root folder
3. Access at `https://{owner}.github.io/{repo}/`
4. The demo app will work directly from GitHub Pages

## Rate Limits

- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour
- File size limit: 100MB
- Recommended repo size: < 5GB

## Troubleshooting

- **401 Unauthorized**: Token expired or invalid
- **404 Not Found**: File/path doesn't exist
- **409 Conflict**: SHA mismatch (file was modified)
- **422 Unprocessable**: Invalid request (check JSON format)
