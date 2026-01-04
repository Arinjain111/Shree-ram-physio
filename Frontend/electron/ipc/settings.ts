import { ipcMain, app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

interface AppSettings {
    invoiceSaveLocation: string;
}

function getSettings(): AppSettings {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading settings:', error);
    }

    // Default settings
    return {
        invoiceSaveLocation: path.join(app.getPath('downloads'), 'Invoices')
    };
}

function saveSettings(settings: AppSettings): void {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

export { getSettings };

export function registerSettingsHandlers() {
    ipcMain.handle('get-save-location', async () => {
        const settings = getSettings();
        return { success: true, location: settings.invoiceSaveLocation };
    });

    ipcMain.handle('set-save-location', async (_event, location: string) => {
        try {
            const settings = getSettings();
            settings.invoiceSaveLocation = location;
            saveSettings(settings);
            return { success: true, location };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('choose-save-location', async () => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory', 'createDirectory'],
                title: 'Choose Invoice Save Location',
                defaultPath: getSettings().invoiceSaveLocation
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const location = result.filePaths[0];
                const settings = getSettings();
                settings.invoiceSaveLocation = location;
                saveSettings(settings);
                return { success: true, location };
            }

            return { success: false, error: 'No location selected' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });
}
