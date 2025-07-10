# Release Instructions for ClearFeed RSS Reader

This document provides instructions for publishing new releases with auto-update functionality.

## Prerequisites

1. **GitHub Personal Access Token (GH_TOKEN)**
   - Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
   - Generate a new token with `repo` scope (full control of private repositories)
   - Copy the token and set it as an environment variable:
     ```bash
     export GH_TOKEN=your_github_token_here
     ```
   - For permanent setup, add it to your shell profile (`.bashrc`, `.zshrc`, etc.)

2. **Dependencies**
   - Ensure `electron-builder` and `electron-updater` are installed:
     ```bash
     npm install
     ```

## Publishing a New Release

### Step 1: Version Bump
Update the version in `package.json`:
```bash
npm version patch  # for bug fixes
npm version minor  # for new features
npm version major  # for breaking changes
```

### Step 2: Build and Publish
Run the publish command which will build and upload to GitHub Releases:
```bash
npm run publish
```

This command will:
- Build the application for all platforms (macOS, Windows, Linux)
- Create distribution files
- Upload them to GitHub Releases
- Generate update metadata files

### Step 3: Verify Release
1. Check GitHub Releases page: `https://github.com/forresttindall/ClearFeed-RSS-Reader/releases`
2. Ensure all platform files are uploaded:
   - **macOS**: `.dmg` and `.zip` files (Intel and Apple Silicon)
   - **Windows**: `.exe` files
   - **Linux**: `.AppImage` and `.tar.gz` files (x64 and ARM64)
3. Verify `latest.yml`, `latest-mac.yml`, and `latest-linux.yml` are present

## Auto-Update Process

### How It Works
1. When users launch the app, it checks for updates from GitHub Releases
2. If an update is available, it downloads in the background
3. Users are notified when the download is complete
4. The app restarts with the new version

### Update Channels
- **Production**: Uses the `latest` release tag
- **Development**: Auto-updates are disabled in development mode

### Logs
Update events are logged to the console:
- `Checking for update...`
- `Update available: [version info]`
- `Update not available`
- `Download progress: [percentage]`
- `Update downloaded: [version info]`
- `Error in auto-updater: [error details]`

## Troubleshooting

### Common Issues

1. **GH_TOKEN not set**
   ```
   Error: GitHub token is not set
   ```
   Solution: Set the `GH_TOKEN` environment variable

2. **Build fails**
   - Ensure all dependencies are installed: `npm install`
   - Check that the version in `package.json` is properly formatted
   - Verify the GitHub repository URL is correct

3. **Upload fails**
   - Check GitHub token permissions (needs `repo` scope)
   - Ensure the repository exists and you have write access
   - Verify network connectivity

4. **Auto-update not working**
   - Check console logs for error messages
   - Ensure the app is not running in development mode
   - Verify the GitHub repository is public or token has access

### Manual Build (without publishing)
To build without publishing:
```bash
npm run pack    # Build for current platform only
npm run dist    # Build for all platforms
```

## File Structure

After building, the `dist/` directory contains:
```
dist/
├── ClearFeed-1.0.0.dmg              # macOS installer (Intel)
├── ClearFeed-1.0.0-arm64.dmg        # macOS installer (Apple Silicon)
├── ClearFeed-1.0.0-mac.zip          # macOS portable (Intel)
├── ClearFeed-1.0.0-arm64-mac.zip    # macOS portable (Apple Silicon)
├── ClearFeed Setup 1.0.0.exe        # Windows installer
├── ClearFeed-1.0.0.AppImage          # Linux AppImage (x64)
├── ClearFeed-1.0.0-arm64.AppImage    # Linux AppImage (ARM64)
├── ClearFeed-1.0.0.tar.gz           # Linux archive (x64)
├── ClearFeed-1.0.0-arm64.tar.gz     # Linux archive (ARM64)
├── latest.yml                        # Windows update metadata
├── latest-mac.yml                    # macOS update metadata
└── latest-linux.yml                  # Linux update metadata
```

## Security Notes

- Keep your GitHub token secure and never commit it to the repository
- The token should have minimal required permissions (`repo` scope only)
- Consider using GitHub Actions for automated releases in production environments
- Auto-updates use HTTPS and verify signatures for security