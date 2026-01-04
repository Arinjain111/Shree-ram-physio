import { autoUpdater } from 'electron-updater';

export function setupAutoUpdates() {
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
        // ignore update errors to keep app running
    });
}
