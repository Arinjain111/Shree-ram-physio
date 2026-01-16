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
        // Auto-download so updates are seamless; we still prompt for restart.
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        let restartPromptDeferred = false;
        const getWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

        const showMessageBoxSafe = async (options: Electron.MessageBoxOptions) => {
            const win = getWindow();
            try {
                // Passing `undefined` makes it app-modal when no window exists.
                return await dialog.showMessageBox(win ?? undefined, options);
            } catch (e) {
                // If a dialog cannot be shown (rare), never crash.
                console.warn('[AutoUpdate] showMessageBox failed:', e);
                return { response: 1, checkboxChecked: false } as any;
            }
        };

        const promptRestartWhenReady = async (version: string) => {
            if (restartPromptDeferred) return;

            const result = await showMessageBoxSafe({
                type: 'info',
                title: 'Update Ready',
                message: `Version ${version} has been downloaded.`,
                detail: 'Restart now to install the update?',
                buttons: ['Restart Now', 'Later'],
                defaultId: 0,
                cancelId: 1,
                noLink: true,
            });

            if (result.response === 0) {
                // quitAndInstall(silent, forceRunAfter)
                autoUpdater.quitAndInstall(false, true);
            } else {
                restartPromptDeferred = true;
            }
        };

        autoUpdater.on('error', (err) => {
            // Never crash the app for updater issues
            console.error('[AutoUpdate] error:', err);
        });

        autoUpdater.on('checking-for-update', () => {
            console.log('[AutoUpdate] checking-for-update');
        });

        autoUpdater.on('update-not-available', (info) => {
            console.log('[AutoUpdate] update-not-available', { version: info?.version });
        });

        autoUpdater.on('update-available', async (info) => {
            console.log('[AutoUpdate] update-available', { version: info?.version });

            // With autoDownload=true, downloading starts automatically.
            // Keep this informational and non-blocking.
            await showMessageBoxSafe({
                type: 'info',
                title: 'Update Available',
                message: `A new version (${info.version}) is available.`,
                detail: 'Downloading in the background. You will be prompted to restart once it is ready.',
                buttons: ['OK'],
                defaultId: 0,
                noLink: true,
            });
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

            console.log('[AutoUpdate] update-downloaded', { version: info?.version });

            // If no window exists yet, wait for one to be created to show the prompt.
            if (!win) {
                const version = info?.version ?? '';
                app.once('browser-window-created', () => {
                    void promptRestartWhenReady(version);
                });
                return;
            }

            await promptRestartWhenReady(info.version);
        });

        const check = async (label: string) => {
            if (restartPromptDeferred) return;
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
