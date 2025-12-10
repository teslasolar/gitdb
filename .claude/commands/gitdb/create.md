---
description: Create a new document in a GitDB collection
---

# GitDB Create Document

You are helping create a new document in a GitDB collection.

## Arguments
- `$1` - Collection name (required)
- `$2` - Document ID (optional, will generate if not provided)
- Remaining arguments or interactive input for document data

## Tasks

1. **Validate Collection Exists**
   - Check if `data/collections/{collection}/index.json` exists
   - If not, ask user if they want to create it first

2. **Generate Document ID** (if not provided)
   - Format: `{collection}_{timestamp}_{random}`
   - Example: `user_1702234567_a3f2`

3. **Get Document Data**
   - If schema exists at `data/schemas/{collection}.json`, show required fields
   - Ask user for field values interactively or accept JSON input
   - Validate against schema if available

4. **Create Document**
   - Write to `data/collections/{collection}/{id}.json`
   - Add metadata: `_id`, `_createdAt`, `_updatedAt`
   - Update `data/collections/{collection}/index.json`

5. **Commit Changes**
   - Stage the new document and updated index
   - Create commit with message: `Create {collection}/{id}`

## Document Format
```json
{
  "_id": "user_001",
  "_createdAt": "2024-12-10T12:00:00.000Z",
  "_updatedAt": "2024-12-10T12:00:00.000Z",
  "name": "John Doe",
  "email": "john@example.com"
}
```

## Example Usage
```
/gitdb/create users                     # Interactive mode
/gitdb/create users user_001            # With specific ID
/gitdb/create posts post_001 --title "Hello" --content "World"
```

## Output
- Confirm document creation
- Show the created document
- Show git commit info
