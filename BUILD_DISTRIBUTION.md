# ClearFeed Distribution Guide

This guide is for developers to build and distribute ClearFeed desktop application packages across Windows, macOS, and Linux platforms.

## Developer Prerequisites

### System Requirements
- **Node.js**: Version 16 or higher
- **npm**: Version 8 or higher
- **Git**: For version control

### Platform-Specific Requirements

#### macOS (for building macOS packages)
- **Xcode Command Line Tools**: Required for native module compilation
- **macOS 10.13** or higher for building
- **Apple Developer Account**: Required for code signing and notarization

#### Windows (for building Windows packages)
- **Visual Studio Build Tools**: Required for native module compilation
- **Windows 10** or higher recommended
- **Code Signing Certificate**: Recommended for production releases

#### Linux (for building Linux packages)
- **Build essentials**: `sudo apt-get install build-essential`
- **Additional dependencies**: `sudo apt-get install libnss3-dev libatk-bridge2.0-dev libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2-dev`

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/clearfeed.git
   cd clearfeed
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

## Building Distribution Packages

### Manual Building for Distribution

#### Build All Platforms
```bash
npm run build:all
```

#### Platform-Specific Builds

**macOS** (DMG and ZIP packages):
```bash
npm run build:mac
```

**Windows** (EXE installer and portable ZIP):
```bash
npm run build:win
```

**Linux** (AppImage, DEB, RPM, TAR.GZ):
```bash
npm run build:linux
```

### Distribution File Output

All distribution files are generated in the `dist/` directory with consistent naming:

**Generated Files**:
- **macOS**: `ClearFeed-{version}-mac-x64.dmg`, `ClearFeed-{version}-mac-arm64.dmg`, `ClearFeed-{version}-mac-x64.zip`, `ClearFeed-{version}-mac-arm64.zip`
- **Windows**: `ClearFeed-{version}-win-x64.exe`, `ClearFeed-{version}-win-ia32.exe`, `ClearFeed-{version}-win-x64.zip`, `ClearFeed-{version}-win-ia32.zip`
- **Linux**: `ClearFeed-{version}-linux-x64.AppImage`, `ClearFeed-{version}-linux-x64.deb`, `ClearFeed-{version}-linux-x64.rpm`, `ClearFeed-{version}-linux-x64.tar.gz`

### Automated GitHub Releases (Recommended)

The project includes a GitHub Actions workflow that automatically builds and releases the application when you push a version tag.

#### Creating an Automated Release

1. **Update version in package.json**:
   ```bash
   npm version patch  # or minor, major
   ```

2. **Push the tag**:
   ```bash
   git push origin main --tags
   ```

3. **GitHub Actions will automatically**:
   - Build for all platforms (macOS, Windows, Linux)
   - Create distribution files
   - Create a new GitHub Release
   - Upload all distribution files as release assets

#### Automated Release Workflow

The workflow (`.github/workflows/release.yml`) performs the following:

1. **Triggers**: On push of tags matching `v*` (e.g., `v1.0.0`)
2. **Builds**: Parallel builds for macOS, Windows, and Linux
3. **Artifacts**: Creates platform-specific distribution files
4. **Release**: Automatically creates GitHub Release with all files



## Distribution Workflow

### Manual Distribution Process

1. **Build the application**:
   ```bash
   npm run build:all
   ```

2. **Locate distribution files** in the `dist/` directory

3. **Upload to distribution platform**:
   - **GitHub Releases**: Upload files as release assets
   - **Direct hosting**: Upload to your web server
   - **App stores**: Follow platform-specific submission processes

### Code Signing (Production)

#### macOS
- **Developer ID**: Required for distribution outside Mac App Store
- **Notarization**: Required for macOS 10.15+
- Configure in `package.json` under `build.mac`

#### Windows
- **Code signing certificate**: Recommended for user trust
- Configure in `package.json` under `build.win`

#### Linux
- **GPG signing**: For package repositories
- Generally optional for direct distribution

## Testing Distribution Files

### Pre-Release Testing

1. **Install on clean systems**:
   - Test each platform's installer
   - Verify application launches correctly
   - Check all features work as expected

2. **File integrity checks**:
   - Verify file sizes are reasonable
   - Ensure no missing dependencies
   - Test uninstallation process

3. **Security scanning**:
   - Run antivirus scans on Windows executables
   - Verify code signatures are valid

### Distribution Platforms

#### GitHub Releases (Recommended)
- Free hosting for open-source projects
- Automatic download statistics
- Version management
- User-friendly download interface

#### Direct Distribution
- Host files on your own server
- Full control over distribution
- Custom download pages
- Requires hosting infrastructure

## Code Signing (Recommended for Production)

### macOS Code Signing
Add to package.json build configuration:
```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)",
  "hardenedRuntime": true,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist"
}
```

### Windows Code Signing
Add to package.json build configuration:
```json
"win": {
  "certificateFile": "path/to/certificate.p12",
  "certificatePassword": "password",
  "publisherName": "Your Company Name"
}
```

## Release Checklist

### Before Building
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` or release notes
- [ ] Run tests and ensure all pass
- [ ] Verify all dependencies are up to date

### Building
- [ ] Clean previous builds (`rm -rf dist node_modules`)
- [ ] Fresh install dependencies (`npm install`)
- [ ] Build for all platforms (`npm run build:all`)
- [ ] Verify all expected files are generated

### Testing
- [ ] Test installation on clean systems
- [ ] Verify application launches and functions correctly
- [ ] Check file sizes are reasonable
- [ ] Validate code signatures (if applicable)

### Distribution
- [ ] Upload to GitHub Releases or hosting platform
- [ ] Update download links and documentation
- [ ] Announce release to users
- [ ] Monitor for issues and user feedback

## Troubleshooting

### Common Issues

1. **Native dependencies**: Some npm packages require rebuilding for different platforms
2. **File permissions**: Ensure executable permissions are set correctly
3. **Code signing**: Unsigned apps may trigger security warnings
4. **Architecture mismatches**: Ensure you're building for the correct CPU architectures

### Build Errors

- Check that all dependencies are installed
- Ensure you have the required build tools for your platform
- Verify that the frontend build completes successfully
- Check electron-builder logs for specific error messages

## Next Steps

1. Set up automated builds using GitHub Actions or similar CI/CD
2. Implement crash reporting and analytics
3. Set up user feedback collection
4. Plan for regular updates and maintenance
5. Consider implementing telemetry for usage insights

---

**Note**: Building for all platforms from a single machine may require additional setup. For best results, consider using cloud build services or dedicated build machines for each platform.