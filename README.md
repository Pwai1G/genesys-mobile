# Genesys Active Conversations - GitHub Pages

Mobile web for Genesys Cloud Japan region.

## 1. Create Genesys OAuth client

In Genesys Cloud Admin, create an OAuth client for a browser / SPA using **Token Implicit Grant**.

Set the authorized redirect URI to the exact GitHub Pages URL you will use, for example:

    https://YOUR_GITHUB_USERNAME.github.io/genesys-mobile/

Copy the OAuth Client ID.

## 2. Edit config.js

Replace:

    PUT_YOUR_GENESYS_OAUTH_CLIENT_ID_HERE

with your Genesys OAuth Client ID.

Defaults:

- Login: https://login.mypurecloud.jp
- API: https://api.mypurecloud.jp

## 3. Upload to GitHub

Create a repository such as:

    genesys-mobile

Upload all files in this package to the repository root.

## 4. Enable GitHub Pages

GitHub repository:

    Settings
    -> Pages
    -> Build and deployment
    -> Deploy from a branch
    -> Branch: main
    -> Folder: / (root)
    -> Save

Your URL will normally be:

    https://YOUR_GITHUB_USERNAME.github.io/genesys-mobile/

The GitHub Pages URL must exactly match the authorized Redirect URI configured in the Genesys OAuth client.

## 5. Use from mobile

Open the GitHub Pages URL in Chrome/Safari.

1. Tap Login with Genesys Cloud.
2. Login on the real Genesys Cloud login page.
3. Genesys redirects back to this web app with a user access token.
4. Tap Load Active.
5. Select interactions.
6. Tap Disconnect Selected.

The application does NOT collect Genesys username/password.

The OAuth access token is stored only in browser sessionStorage, not localStorage.

## Permissions

The logged-in Genesys user still needs the Genesys Cloud permissions required to:

- query conversation analytics
- view relevant conversations/divisions
- disconnect conversations

If an API returns 403, review the role/permissions/division access of that user.

## Important

This is a static GitHub Pages app. Never put an OAuth client secret in these files.

GitHub Pages is publicly reachable, so do not put passwords, client secrets, private API keys, or internal company data in this repository.

For production enterprise use, consider using a private/internal hosting platform and your organization's security review.
