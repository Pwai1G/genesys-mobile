# Genesys Mobile - Bearer Token Mode

Static GitHub Pages version for mobile.

No OAuth Client ID is used.

## Features

- Paste Genesys Bearer Token
- Test Token
- Load active conversations
- Voice-only filter
- Search
- Select All
- Disconnect selected conversations
- Double confirmation
- Session-only token storage

## Upload to GitHub

Upload these files to the repository root:

- index.html
- app.js
- manifest.json
- icon.svg
- .nojekyll
- README.md

Then enable GitHub Pages:

Settings
-> Pages
-> Deploy from a branch
-> main
-> / (root)

## Usage

1. Open GitHub Pages URL on mobile.
2. Paste Bearer Token.
3. Press Test Token.
4. Press Load Active.
5. Select conversations.
6. Press Disconnect Selected.

## Important

The token is stored only in browser sessionStorage.

Do not commit a Bearer Token into GitHub source code.

If the browser shows "Failed to fetch", that indicates browser CORS/network restrictions between GitHub Pages and api.mypurecloud.jp. Static JavaScript cannot bypass CORS by itself.
