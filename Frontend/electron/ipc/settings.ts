import { ipcMain, app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

interface AppSettings {
    invoiceSaveLocation: string;
    autoSaveInvoicePdf: boolean;
}

function getSettings(): AppSettings {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error('settings', 'Error reading settings', { error: error instanceof Error ? error.message : String(error) });
    }

    // Default settings
    return {
        invoiceSaveLocation: path.join(app.getPath('downloads'), 'Invoices'),
        autoSaveInvoicePdf: true
    };
}

function saveSettings(settings: AppSettings): void {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
        logger.error('settings', 'Error saving settings', { error: error instanceof Error ? error.message : String(error) });
    }
}

export { getSettings };

export function registerSettingsHandlers() {
    ipcMain.handle('get-invoice-settings', async () => {
        const settings = getSettings();
        return {
            success: true,
            invoiceSaveLocation: settings.invoiceSaveLocation,
            autoSaveInvoicePdf: settings.autoSaveInvoicePdf
        };
    });

    ipcMain.handle('set-auto-save-invoice-pdf', async (_event, enabled: boolean) => {
        try {
            const settings = getSettings();
            settings.autoSaveInvoicePdf = Boolean(enabled);
            saveSettings(settings);
            return { success: true, autoSaveInvoicePdf: settings.autoSaveInvoicePdf };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

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
