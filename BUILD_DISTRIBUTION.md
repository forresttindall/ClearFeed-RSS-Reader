# ClearFeed Distribution Guide

This guide explains how to build and distribute ClearFeed for multiple platforms (Windows, macOS, and Linux).

## Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. **Platform-specific requirements:**
   - **macOS**: Xcode Command Line Tools
   - **Windows**: Windows SDK (for building Windows apps on Windows)
   - **Linux**: Standard build tools (gcc, make, etc.)

## Installation

1. Clone the repository and install dependencies:
```bash
cd ClearFeed
npm install
cd frontend
npm install
cd ..
```

## Building for Distribution

### Build for All Platforms
```bash
npm run build:all
```
This creates distributables for macOS, Windows, and Linux.

### Build for Specific Platforms

#### macOS Only
```bash
npm run build:mac
```
Creates:
- `.dmg` installer for macOS
- `.zip` archive for macOS
- Supports both Intel (x64) and Apple Silicon (arm64)

#### Windows Only
```bash
npm run build:win
```
Creates:
- `.exe` NSIS installer for Windows
- Portable `.exe` (no installation required)
- Supports x64, x86 (ia32), and ARM64 architectures

#### Linux Only
```bash
npm run build:linux
```
Creates:
- `.AppImage` (universal Linux package)
- `.deb` package (Debian/Ubuntu)
- `.rpm` package (Red Hat/Fedora/SUSE)
- Supports x64 and ARM64 architectures

## Output Files

All built files will be located in the `dist/` directory:

```
dist/
├── ClearFeed-1.0.0.dmg                    # macOS DMG installer
├── ClearFeed-1.0.0-mac.zip                # macOS ZIP archive
├── ClearFeed-1.0.0-arm64.dmg              # macOS ARM64 DMG
├── ClearFeed-1.0.0-arm64-mac.zip          # macOS ARM64 ZIP
├── ClearFeed Setup 1.0.0.exe              # Windows installer
├── ClearFeed 1.0.0.exe                    # Windows portable
├── ClearFeed-1.0.0-win32-x64.exe          # Windows x64 portable
├── ClearFeed-1.0.0-win32-arm64.exe        # Windows ARM64 portable
├── ClearFeed-1.0.0.AppImage               # Linux AppImage
├── clearfeed_1.0.0_amd64.deb              # Linux DEB package
├── clearfeed-1.0.0.x86_64.rpm             # Linux RPM package
└── ...
```

## Distribution Strategies

### 1. Direct Download
- Upload files to your website
- Provide download links for each platform
- Include checksums for security verification

### 2. GitHub Releases
- Create a new release on GitHub
- Upload all distribution files as release assets
- Users can download directly from GitHub

### 3. App Stores

#### macOS App Store
- Requires Apple Developer account ($99/year)
- Need to configure code signing in package.json
- Submit through App Store Connect

#### Microsoft Store
- Requires Microsoft Developer account
- Can distribute MSIX packages
- Submit through Partner Center

#### Linux Package Repositories
- Submit to Flathub (Flatpak)
- Submit to Snap Store (Snapcraft)
- Submit to AUR (Arch User Repository)

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

## Auto-Updates (Optional)

To enable automatic updates, you can integrate with services like:
- **electron-updater** with GitHub Releases
- **Hazel** for simple update server
- **Nuts** for more advanced update management

## Monetization Options

### 1. License Key System
- Implement license validation in the app
- Use services like Gumroad, Paddle, or Stripe for payments
- Distribute license keys to paying customers

### 2. Subscription Model
- Integrate with payment processors
- Implement user authentication
- Restrict features based on subscription status

### 3. One-time Purchase
- Sell through app stores (they handle payments)
- Use payment processors for direct sales
- Provide download links after purchase

## Testing Distribution

1. **Test on target platforms**: Always test your built applications on the actual target operating systems
2. **Virtual machines**: Use VMs to test on different OS versions
3. **Beta testing**: Distribute to a small group before public release
4. **Automated testing**: Set up CI/CD pipelines for automated building and testing

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