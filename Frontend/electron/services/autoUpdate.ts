import { app } from 'electron';

export function setupAutoUpdates() {
    // Skip auto-updates in development
    if (!app.isPackaged) {
        console.log('Skip checkForUpdates because application is not packed and dev update config is not forced');
        return;
    }

    // TODO: Re-enable auto-updates after packaging issue is resolved
    // The update-electron-app module is not being bundled correctly in the asar package
    console.log('[AutoUpdate] Auto-updates temporarily disabled');
    return;

    // Use free update.electronjs.org service for open source apps
    // Using require() because update-electron-app is CommonJS
    // try {
    //     const updateElectronApp = require('update-electron-app');
    //     updateElectronApp({
    //         repo: 'Arinjain111/Shree-ram-physio',
    //         updateInterval: '1 hour',
    //         logger: console,
    //     });
    //     console.log('[AutoUpdate] Configured successfully');
    // } catch (error) {
    //     console.error('[AutoUpdate] Failed to setup:', error);
    //     // App will continue without auto-update functionality
    // }
}
