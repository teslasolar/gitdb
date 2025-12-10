---
description: Deploy GitDB to GitHub Pages
---

# GitDB Deploy to GitHub Pages

You are helping deploy the GitDB application to GitHub Pages.

## Arguments
- `$1` - Environment: `production`, `staging`, or branch name
- `--message` - Custom commit message

## Tasks

### Pre-Deploy Checks
1. **Verify Repository**
   - Ensure we're in a git repository
   - Check remote origin is set
   - Verify GitHub Pages is enabled (or guide to enable)

2. **Validate Application**
   - Check index.html exists
   - Verify js/gitdb.js and js/gitdb-auth.js exist
   - Validate config.json syntax

3. **Check OAuth Configuration**
   - Verify GitHub OAuth App client ID is set in app.js
   - Ensure callback URL matches GitHub Pages URL
   - Warn if using demo client ID

### Deploy Steps

1. **Commit Any Changes**
   ```bash
   git add .
   git commit -m "Deploy: {message or timestamp}"
   ```

2. **Push to GitHub**
   ```bash
   git push origin main
   ```

3. **Verify Deployment**
   - Check GitHub Pages URL
   - Wait for GitHub Actions (if configured)
   - Test the deployed application

### GitHub Pages Setup (if not enabled)
1. Go to repository Settings → Pages
2. Source: Deploy from branch
3. Branch: main, folder: / (root)
4. Save

The site will be available at:
`https://{owner}.github.io/{repo}/`

## OAuth App Configuration

For GitHub OAuth to work on GitHub Pages:

1. **Create OAuth App** (if not done):
   - Go to: https://github.com/settings/developers
   - Click "New OAuth App"
   - Application name: `GitDB - {your-name}`
   - Homepage URL: `https://{owner}.github.io/{repo}/`
   - Authorization callback URL: `https://{owner}.github.io/{repo}/`

2. **Update Client ID**:
   - Copy the Client ID
   - Update in `js/app.js`:
     ```javascript
     const GITHUB_CLIENT_ID = 'your_client_id_here';
     ```

3. **Enable Device Flow**:
   - In OAuth App settings, check "Enable Device Flow"
   - This allows authentication without a backend

## Example Usage
```
/gitdb/deploy                      # Deploy to production
/gitdb/deploy --message "Add new feature"
/gitdb/deploy staging              # Deploy to staging branch
```

## Output
```
GitDB Deployment
================
Repository: owner/gitdb
Branch: main
Environment: production

Steps completed:
✓ Pre-deploy validation
✓ Changes committed (abc1234)
✓ Pushed to origin/main
✓ GitHub Pages deployment triggered

Your app is live at:
https://owner.github.io/gitdb/

OAuth Setup:
✓ Client ID configured
✓ Callback URL matches deployment URL
✓ Device Flow enabled

Next steps:
1. Wait 1-2 minutes for GitHub Pages to update
2. Visit your deployment URL
3. Click "Login with GitHub" to test authentication
```
