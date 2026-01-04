import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

export function setupAutoUpdates() {
    // Skip auto-updates in development
    if (!app.isPackaged) {
        console.log('[AutoUpdate] Skip checkForUpdates because application is not packaged');
        return;
    }

    try {
        // Configure electron-updater
        autoUpdater.logger = console;
        autoUpdater.autoDownload = false; // We'll prompt the user
        autoUpdater.autoInstallOnAppQuit = true;

        let updateAvailableButDeferred = false;
        const getWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

        autoUpdater.on('error', (err) => {
            // Never crash the app for updater issues
            console.error('[AutoUpdate] error:', err);
        });

        autoUpdater.on('update-available', async (info) => {
            if (updateAvailableButDeferred) return;

            const win = getWindow();
            const result = await dialog.showMessageBox(win ?? undefined, {
                type: 'info',
                title: 'Update Available',
                message: `A new version (${info.version}) is available.`,
                detail: 'Do you want to download it now? The update will be installed when you restart the app.',
                buttons: ['Download', 'Later'],
                defaultId: 0,
                cancelId: 1,
                noLink: true,
            });

            if (result.response === 0) {
                try {
                    await autoUpdater.downloadUpdate();
                } catch (e) {
                    console.warn('[AutoUpdate] downloadUpdate failed:', e);
                }
            } else {
                updateAvailableButDeferred = true;
            }
        });

        autoUpdater.on('download-progress', (progress) => {
            const win = getWindow();
            if (!win) return;
            const fraction = Math.max(0, Math.min(1, progress.percent / 100));
            win.setProgressBar(fraction);
        });

        autoUpdater.on('update-downloaded', async (info) => {
            const win = getWindow();
            if (win) win.setProgressBar(-1);

            const result = await dialog.showMessageBox(win ?? undefined, {
                type: 'info',
                title: 'Update Ready',
                message: `Version ${info.version} has been downloaded.`,
                detail: 'Restart now to install the update?',
                buttons: ['Restart Now', 'Later'],
                defaultId: 0,
                cancelId: 1,
                noLink: true,
            });

            if (result.response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });

        const check = async (label: string) => {
            if (updateAvailableButDeferred) return;
            try {
                await autoUpdater.checkForUpdates();
            } catch (err) {
                // Most common while you're setting up releases: latest.yml isn't there yet.
                console.warn(`[AutoUpdate] ${label} check failed:`, err);
            }
        };

        // Check for updates on startup
        void check('startup');

        // Check for updates every hour
        setInterval(() => {
            void check('periodic');
        }, 60 * 60 * 1000);

        console.log('[AutoUpdate] Configured successfully with electron-updater');
    } catch (error) {
        console.error('[AutoUpdate] Failed to setup:', error);
        // App will continue without auto-update functionality
    }
}
