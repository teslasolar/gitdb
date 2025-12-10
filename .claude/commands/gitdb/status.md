---
description: Show GitDB database status and health
---

# GitDB Status

You are showing the current status of the GitDB database.

## Tasks

1. **Repository Status**
   - Current branch
   - Commits ahead/behind remote
   - Uncommitted changes

2. **Database Status**
   - List all collections
   - Document count per collection
   - Last modified timestamps

3. **Configuration**
   - Show current config.json settings
   - List enabled features

4. **Health Checks**
   - Verify all index files exist and are valid
   - Check for orphaned documents
   - Validate JSON syntax in all files
   - Check file sizes

5. **Authentication Status**
   - Check if GITHUB_TOKEN is set
   - Verify OAuth App configuration
   - Test API connectivity

## Output Format

```
GitDB Status
============

Repository:
  Branch: main
  Remote: origin/main
  Status: Up to date (or X commits ahead, Y behind)
  Changes: None (or list uncommitted files)

Database:
  Collections: 3
  ┌────────────┬───────────┬─────────────────────┐
  │ Collection │ Documents │ Last Modified       │
  ├────────────┼───────────┼─────────────────────┤
  │ users      │ 5         │ 2024-12-10 12:00:00 │
  │ posts      │ 12        │ 2024-12-10 11:30:00 │
  │ comments   │ 45        │ 2024-12-10 11:45:00 │
  └────────────┴───────────┴─────────────────────┘
  Total: 62 documents

Configuration:
  Version: 1.0.0
  Features: analytics (enabled), darkMode (disabled)

Health:
  ✓ All index files valid
  ✓ No orphaned documents
  ✓ JSON syntax OK
  ✓ No oversized files

Authentication:
  ✓ GitHub token configured
  ✓ API connection OK (Rate limit: 4,892/5,000)
```

## Example Usage
```
/gitdb/status           # Full status
/gitdb/status --brief   # Just summary
/gitdb/status --health  # Only health checks
```
