# GitHub OAuth Setup for GitDB

This guide explains how to set up GitHub OAuth authentication for GitDB when deployed to GitHub Pages.

## Overview

GitDB uses **GitHub Device Flow** for authentication, which allows users to authenticate without needing a backend server. This is perfect for GitHub Pages deployments.

## Step 1: Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"OAuth Apps"** in the sidebar
3. Click **"New OAuth App"**

Fill in the form:
- **Application name**: `GitDB - Your App Name`
- **Homepage URL**: `https://YOUR_USERNAME.github.io/YOUR_REPO/`
- **Application description**: (optional) `GitDB database management`
- **Authorization callback URL**: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

4. Click **"Register application"**

## Step 2: Enable Device Flow

After creating the app:

1. On the OAuth App page, scroll to **"Device Flow"**
2. Check the box **"Enable Device Flow"**
3. Click **"Update application"**

This is crucial! Device Flow allows authentication from static sites without a backend.

## Step 3: Copy Your Client ID

On the OAuth App page, you'll see:
- **Client ID**: `Ov23li...` (copy this!)
- **Client secrets**: (NOT needed for Device Flow)

## Step 4: Update Your GitDB Configuration

Edit `js/app.js` and replace the demo client ID:

```javascript
// Replace this line:
const GITHUB_CLIENT_ID = 'Ov23liUdRWBoMHsX1LDt'; // Demo client ID

// With your client ID:
const GITHUB_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
```

## Step 5: Deploy to GitHub Pages

1. Commit your changes:
   ```bash
   git add .
   git commit -m "Configure OAuth for GitHub Pages"
   git push origin main
   ```

2. Enable GitHub Pages:
   - Go to your repository's **Settings**
   - Click **"Pages"** in the sidebar
   - Under **"Source"**, select **"Deploy from a branch"**
   - Choose **"main"** branch and **"/ (root)"** folder
   - Click **"Save"**

3. Wait 1-2 minutes for deployment

4. Your app will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## How Authentication Works

### Device Flow Process

1. User clicks **"Login with GitHub"**
2. App requests a device code from GitHub
3. User sees a code (e.g., `ABCD-1234`)
4. User goes to [github.com/login/device](https://github.com/login/device)
5. User enters the code
6. App automatically detects when authorized
7. Token is stored in localStorage for future sessions

### Token Storage

- Tokens are stored in `localStorage` under key `gitdb_auth`
- Tokens persist across browser sessions
- Users can logout to clear the token

### Automatic Re-authentication

On page load, GitDB:
1. Checks for existing token in localStorage
2. Validates the token with GitHub API
3. If valid: auto-login, show user profile
4. If invalid: clear token, show login button

## Security Considerations

### What's Safe

- **Client ID is public** - It's meant to be visible in client-side code
- **Device Flow** - Designed for apps without backends
- **Token in localStorage** - Standard practice for SPAs

### Best Practices

1. **Never commit tokens** - Only the Client ID goes in code
2. **Use fine-grained tokens** - Limit scope to only needed repos
3. **HTTPS only** - GitHub Pages provides this automatically

### Token Permissions

The default scope is `repo`, which allows:
- Read/write access to repositories
- Read user profile info

For read-only access, you can modify `js/gitdb-auth.js`:
```javascript
this.scopes = config.scopes || ['public_repo']; // Read-only public repos
```

## Troubleshooting

### "Bad credentials" error
- Token may have expired
- Click logout, then login again

### Device code expired
- Codes expire after 15 minutes
- Start the login process again

### "Not found" when accessing repo
- Ensure the token has access to the repository
- Check if the repo is private (needs full `repo` scope)

### OAuth app not authorized
- User needs to authorize the OAuth app
- Check organization settings if repo is in an org

## Multiple Environments

For different environments (dev/staging/prod), create separate OAuth apps:

| Environment | Homepage URL | Callback URL |
|-------------|--------------|--------------|
| Development | `http://localhost:8080/` | `http://localhost:8080/` |
| Staging | `https://user.github.io/gitdb-staging/` | `https://user.github.io/gitdb-staging/` |
| Production | `https://user.github.io/gitdb/` | `https://user.github.io/gitdb/` |

Then use environment detection in your app:
```javascript
const CLIENT_IDS = {
    'localhost': 'dev_client_id',
    'user.github.io/gitdb-staging': 'staging_client_id',
    'user.github.io/gitdb': 'prod_client_id'
};

const GITHUB_CLIENT_ID = CLIENT_IDS[location.host + location.pathname.replace(/\/$/, '')]
    || CLIENT_IDS['localhost'];
```

## Quick Reference

| Item | Value |
|------|-------|
| Create OAuth App | [github.com/settings/developers](https://github.com/settings/developers) |
| Device Flow URL | [github.com/login/device](https://github.com/login/device) |
| Token Scopes | `repo` (full) or `public_repo` (read-only) |
| Token Storage | `localStorage['gitdb_auth']` |
| Rate Limit | 5,000 requests/hour (authenticated) |
