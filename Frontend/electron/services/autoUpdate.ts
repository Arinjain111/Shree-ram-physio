import { app } from 'electron';

export function setupAutoUpdates() {
    // Skip auto-updates in development
    if (!app.isPackaged) {
        console.log('Skip checkForUpdates because application is not packed and dev update config is not forced');
        return;
    }

    // Use free update.electronjs.org service for open source apps
    // Using require() because update-electron-app is CommonJS
    const updateElectronApp = require('update-electron-app');
    updateElectronApp({
        repo: 'Arinjain111/Shree-ram-physio',
        updateInterval: '1 hour',
        logger: console,
    });
}
