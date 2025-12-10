---
description: Create a backup of the GitDB database
---

# GitDB Backup

You are helping create a backup of the GitDB database.

## Arguments
- `$1` - Backup type: `local`, `branch`, or `tag` (default: local)
- `--name` - Custom backup name
- `--include-history` - Include git history in backup

## Backup Types

### Local Backup
Creates a timestamped copy in `.gitdb-backups/`

```
.gitdb-backups/
└── backup_2024-12-10_120000/
    ├── data/
    │   ├── collections/
    │   ├── schemas/
    │   └── config.json
    └── backup-manifest.json
```

### Branch Backup
Creates a backup branch with current state

```bash
git checkout -b backup/2024-12-10_120000
git push origin backup/2024-12-10_120000
```

### Tag Backup
Creates a git tag at current commit

```bash
git tag -a backup-2024-12-10 -m "Database backup"
git push origin backup-2024-12-10
```

## Tasks

1. **Generate Backup Name**
   - Format: `backup_{date}_{time}` or custom name
   - Validate name doesn't already exist

2. **Create Manifest**
   ```json
   {
     "name": "backup_2024-12-10_120000",
     "created": "2024-12-10T12:00:00.000Z",
     "type": "local",
     "commit": "abc123",
     "collections": ["users", "posts", "comments"],
     "documentCount": 150,
     "size": "2.5MB"
   }
   ```

3. **Execute Backup**
   - Copy files (local) or create branch/tag (git)
   - Verify backup integrity
   - Update backup log

4. **Report Results**
   - Backup location
   - Size and document count
   - Restore instructions

## Example Usage
```
/gitdb/backup                    # Local backup
/gitdb/backup branch             # Create backup branch
/gitdb/backup tag --name v1.0    # Create tagged backup
/gitdb/backup local --include-history
```

## Restore Instructions
```bash
# From local backup:
cp -r .gitdb-backups/backup_name/data ./data

# From branch:
git checkout backup/2024-12-10
# or
git merge backup/2024-12-10

# From tag:
git checkout backup-2024-12-10
```
