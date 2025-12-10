---
description: Query documents in a GitDB collection with filters
---

# GitDB Query Documents

You are helping query documents from a GitDB collection.

## Arguments
- `$1` - Collection name (required)
- `$ARGUMENTS` - Optional filter expressions

## Tasks

1. **Load Collection**
   - Read `data/collections/{collection}/index.json`
   - Get list of document IDs

2. **Load Documents**
   - Read each document from `data/collections/{collection}/{id}.json`
   - Parse JSON content

3. **Apply Filters** (if provided)
   - Parse filter expressions like: `field=value`, `field>value`, `field~contains`
   - Supported operators:
     - `=` or `==` : equals
     - `!=` : not equals
     - `>`, `<`, `>=`, `<=` : comparisons
     - `~` : contains (for strings/arrays)

4. **Sort Results** (if requested)
   - Look for `--sort field` or `--sort field:desc`
   - Default: sort by `_createdAt` descending

5. **Limit Results** (if requested)
   - Look for `--limit N`
   - Default: show all (up to 100)

6. **Display Results**
   - Show count of matching documents
   - Display in formatted table or JSON
   - Include document IDs for reference

## Example Usage
```
/gitdb/query users                           # All users
/gitdb/query users role=admin                # Filter by role
/gitdb/query posts published=true --limit 5  # Recent published posts
/gitdb/query comments postId=post_001        # Comments for a post
/gitdb/query users age>21 --sort name        # Complex query
```

## Output Format
```
Found 3 documents in 'users':

| _id      | name     | email           | role  |
|----------|----------|-----------------|-------|
| user_001 | John Doe | john@ex.com     | admin |
| user_002 | Jane Doe | jane@ex.com     | user  |
| user_003 | Bob Smith| bob@ex.com      | user  |
```

Or as JSON with `--json` flag.
