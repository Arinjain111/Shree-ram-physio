# App Icon Setup

## Windows Icon (.ico)

For Windows, you need a `.ico` file with multiple resolutions. The easiest way:

### Option 1: Using an online converter
1. Create/get a square PNG image (at least 512x512px) with your logo
2. Go to https://icoconvert.com or https://cloudconvert.com/png-to-ico
3. Upload your PNG and convert to .ico (with multiple sizes: 16x16, 32x32, 48x48, 256x256)
4. Save the output as `icon.ico` in this `assets/` folder

### Option 2: Using existing PNG
If you only have a PNG:
1. Place your logo PNG (named `icon.png`) in this folder (at least 512x512px)
2. electron-builder will auto-convert it to .ico (less optimal)

### Current Setup
- The package.json is configured to use `assets/icon.png` or `assets/icon.ico`
- Windows installer will show this icon
- The running app will use this icon in the taskbar and window title

## Quick Fix
If you don't have an icon yet, you can:
1. Create a simple 512x512px PNG with your clinic logo/name
2. Save it as `icon.png` in this folder
3. Rebuild the app

The icon should be:
- Square (same width and height)
- Clear and simple (looks good when small)
- Transparent background (PNG) works best
