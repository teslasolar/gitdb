---
description: Sync GitDB with remote GitHub repository
---

# GitDB Sync

You are helping synchronize the local GitDB with the remote GitHub repository.

## Arguments
- `$1` - Direction: `push`, `pull`, or `both` (default: both)
- `--force` - Force sync even with conflicts
- `--dry-run` - Show what would happen without making changes

## Tasks

### Pre-Sync Checks
1. **Check Git Status**
   - Run `git status` to see uncommitted changes
   - Warn user if there are uncommitted changes

2. **Check Remote**
   - Run `git fetch origin` to get latest remote state
   - Compare local and remote branches

3. **Detect Conflicts**
   - Check if local and remote have diverged
   - List files that would conflict

### Sync Operations

#### Pull (Remote → Local)
1. Run `git pull origin {branch}`
2. Handle merge conflicts if any
3. Validate database integrity after pull
4. Report changes pulled

#### Push (Local → Remote)
1. Ensure all changes are committed
2. Run `git push origin {branch}`
3. Handle push rejection if remote is ahead
4. Report changes pushed

#### Both (Bidirectional)
1. Pull first to get remote changes
2. Resolve any conflicts
3. Push local changes

### Post-Sync
1. Verify index files are consistent
2. Update `config.json` timestamp
3. Report sync summary

## Example Usage
```
/gitdb/sync              # Pull then push
/gitdb/sync pull         # Only pull from remote
/gitdb/sync push         # Only push to remote
/gitdb/sync --dry-run    # Preview changes
/gitdb/sync --force      # Force sync (careful!)
```

## Output
```
GitDB Sync Summary
==================
Direction: bidirectional
Branch: main
Remote: origin

Pull:
  - 3 documents updated
  - 1 document created
  - data/collections/users/user_004.json (new)

Push:
  - 2 commits pushed
  - 5 files changed

Status: Sync complete
```

## Conflict Resolution
If conflicts are detected:
1. List conflicting files
2. Show diff for each conflict
3. Ask user how to resolve:
   - Keep local version
   - Keep remote version
   - Manual merge
