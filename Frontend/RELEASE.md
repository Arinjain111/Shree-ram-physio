# Release Process

This app uses **electron-builder** (NSIS) + **electron-updater** with **GitHub Releases** for automatic updates.

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

This triggers the GitHub Actions workflow (`.github/workflows/electron-release.yml`) which will:
- Build the Windows installer (`.exe`)
- Generate update metadata (`latest.yml`) and a blockmap (`.exe.blockmap`)
- Create/Update the GitHub Release for that tag
- Upload the artifacts to the release

### 3. Automatic Updates

Once published, the installed app will automatically check for updates every hour via **GitHub Releases**.

Users will be notified and can install updates automatically.

## 📦 Distribution Files

Each release creates:
- **`Shri-Ram-Physio-Setup-{version}.exe`** - Windows installer (NSIS)
- **`latest.yml`** - update metadata used by `electron-updater`
- **`Shri-Ram-Physio-Setup-{version}.exe.blockmap`** - differential update metadata

## 🔧 Manual Build & Publish

If you need to build/publish manually:

```bash
cd Frontend

# Build the installer locally (outputs to Frontend/release/)
npm run dist:win
```

## 📋 Requirements

- GitHub Release assets must include `latest.yml` and the referenced installer `.exe`
- For auto-update downloads without authentication, the GitHub repository must be **public**
- Windows runner for building `.exe` files (handled by GitHub Actions)

## 🔄 How Auto-Update Works

1. App checks GitHub Releases every hour
2. If a newer version is found, it downloads the installer referenced by `latest.yml`
3. When the update is downloaded, the app prompts the user to restart

## 📝 Version Scheme

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

Example: `v1.2.3`
