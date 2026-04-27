import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

export function setupAutoUpdates() {
    const getWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

    const sendUpdateStatus = (data: any) => {
        const win = getWindow();
        if (win) {
            win.webContents.send('update-status', data);
        }
    };

    // Always register IPC handlers so renderer calls never throw
    // (auto-updates are disabled in development because the app isn't packaged).
    // In dev we return a clean response instead of "No handler registered".
    ipcMain.removeHandler('install-update');
    ipcMain.removeHandler('check-for-updates');

    let restartPromptDeferred = false;

    ipcMain.handle('install-update', () => {
        if (!app.isPackaged) {
            return { status: 'disabled', reason: 'not_packaged' };
        }
        autoUpdater.quitAndInstall(false, true);
        return { status: 'installing' };
    });

    ipcMain.handle('check-for-updates', async () => {
        if (!app.isPackaged) {
            sendUpdateStatus({ status: 'not-available', version: app.getVersion() });
            return { status: 'disabled', reason: 'not_packaged' };
        }

        if (restartPromptDeferred) return { status: 'deferred' };
        try {
            const result = await autoUpdater.checkForUpdates();
            // Never return electron-updater objects over IPC (not structured-cloneable).
            return { status: 'success', version: result?.updateInfo?.version };
        } catch (err: any) {
            const message = err?.message || 'Unknown error';
            sendUpdateStatus({ status: 'error', error: message });
            return { status: 'error', error: message };
        }
    });

    // Skip auto-updates in development (but keep IPC handlers registered).
    if (!app.isPackaged) {
        console.log('[AutoUpdate] Disabled (app not packaged)');
        return;
    }

    try {
        // Configure electron-updater
        autoUpdater.logger = console;
        // Auto-download so updates are seamless; we still prompt for restart.
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('error', (err) => {
            console.error('[AutoUpdate] error:', err);
            sendUpdateStatus({ status: 'error', error: err?.message || 'Unknown error' });
        });

        autoUpdater.on('checking-for-update', () => {
            console.log('[AutoUpdate] checking-for-update');
            sendUpdateStatus({ status: 'checking' });
        });

        autoUpdater.on('update-not-available', (info) => {
            console.log('[AutoUpdate] update-not-available', { version: info?.version });
            sendUpdateStatus({ status: 'not-available', version: info?.version });
        });

        autoUpdater.on('update-available', async (info) => {
            console.log('[AutoUpdate] update-available', { version: info?.version });
            sendUpdateStatus({ status: 'available', version: info?.version });
            // Download starts automatically, no blocking dialog needed.
        });

        autoUpdater.on('download-progress', (progress) => {
            const win = getWindow();
            if (win) {
                const fraction = Math.max(0, Math.min(1, progress.percent / 100));
                win.setProgressBar(fraction);
            }
            sendUpdateStatus({ status: 'downloading', progress });
        });

        autoUpdater.on('update-downloaded', async (info) => {
            const win = getWindow();
            if (win) {
                win.setProgressBar(-1);
            }

            console.log('[AutoUpdate] update-downloaded', { version: info?.version });
            // Notify the frontend via IPC. The renderer will show a non-intrusive banner.
            sendUpdateStatus({ status: 'downloaded', version: info?.version });
            
            // Mark deferred so periodic checks don't repeatedly download or error
            restartPromptDeferred = true;
        });

        // IPC handlers are registered above (also for dev).

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
