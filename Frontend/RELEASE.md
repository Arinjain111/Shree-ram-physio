# Release Process

This app uses **Electron Forge** with **update.electronjs.org** for automatic updates.

## 🚀 Creating a Release

### 1. Update Version
```bash
cd Frontend
npm version patch  # or minor, or major
```

This will:
- Update `package.json` version
- Create a git commit
- Create a git tag (e.g., `v1.0.1`)

### 2. Push the Tag
```bash
git push origin main --tags
```

This triggers the GitHub Actions workflow which will:
- Build the Windows installer (`.exe`)
- Create a ZIP archive
- Publish a GitHub Release
- Upload the artifacts

### 3. Automatic Updates

Once published, the app will automatically check for updates every hour via **update.electronjs.org**.

Users will be notified and can install updates automatically.

## 📦 Distribution Files

Each release creates:
- **`Shri-Ram-Physio-Setup.exe`** - Windows installer (Squirrel)
- **`shri-ram-physio-win32-x64-*.zip`** - Portable Windows ZIP

## 🔧 Manual Build & Publish

If you need to build/publish manually:

```bash
cd Frontend

# Build only (creates local artifacts in out/)
npm run make

# Build AND publish to GitHub Releases
# Requires GITHUB_TOKEN environment variable
npm run publish
```

## 📋 Requirements

- GitHub repository must be public (for free update.electronjs.org)
- GitHub token with repo permissions (automatically provided in Actions)
- Windows runner for building .exe files

## 🔄 How Auto-Update Works

1. App checks update.electronjs.org every hour
2. Service queries GitHub Releases for latest version
3. If new version found, downloads and installs automatically
4. User sees notification and can restart to apply update

## 📝 Version Scheme

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

Example: `v1.2.3`
