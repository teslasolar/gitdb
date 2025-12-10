---
description: Initialize a new GitDB collection or repository structure
---

# GitDB Initialize

You are helping initialize a GitDB database structure. Based on the arguments provided, perform the appropriate initialization.

## Arguments
- `$ARGUMENTS` - Collection name(s) or "full" for complete setup

## Tasks

### If argument is "full" or empty:
1. Create the complete database structure:
   ```
   data/
   ├── collections/
   │   ├── users/index.json
   │   ├── posts/index.json
   │   └── comments/index.json
   ├── schemas/
   │   ├── user.json
   │   ├── post.json
   │   └── comment.json
   └── config.json
   ```

2. Each `index.json` should contain:
   ```json
   {
     "ids": [],
     "createdAt": "<current ISO timestamp>",
     "updatedAt": "<current ISO timestamp>"
   }
   ```

3. Create a basic `config.json`:
   ```json
   {
     "version": "1.0.0",
     "name": "GitDB Database",
     "collections": ["users", "posts", "comments"],
     "features": {},
     "settings": {
       "maxDocumentSize": 102400,
       "defaultPageSize": 20
     }
   }
   ```

### If argument is a collection name:
1. Create `data/collections/{name}/index.json`
2. Add the collection to `config.json` if it exists
3. Optionally create a schema at `data/schemas/{name}.json`

## Output
After initialization, summarize:
- What directories/files were created
- Current collections available
- Next steps for the user

## Example Usage
```
/gitdb/init full          # Initialize complete structure
/gitdb/init products      # Initialize just 'products' collection
/gitdb/init orders items  # Initialize multiple collections
```
