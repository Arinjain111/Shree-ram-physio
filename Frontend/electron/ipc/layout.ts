import { ipcMain, app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export function registerLayoutHandlers() {

    ipcMain.handle('save-layout', async (_event, layoutConfig: any) => {
        try {
            const configDir = path.join(app.getPath('userData'), 'config');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            const filePath = path.join(configDir, 'invoice-layout.json');
            fs.writeFileSync(filePath, JSON.stringify(layoutConfig, null, 2));

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('load-layout', async () => {
        try {
            const configDir = path.join(app.getPath('userData'), 'config');
            const filePath = path.join(configDir, 'invoice-layout.json');

            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                return { success: true, layout: JSON.parse(content) };
            } else {
                return { success: true, layout: null };
            }
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('select-logo', async () => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
                ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const fileContent = fs.readFileSync(filePath);
                const base64 = fileContent.toString('base64');
                const ext = path.extname(filePath).slice(1);

                return {
                    success: true,
                    dataUrl: `data:image/${ext};base64,${base64}`
                };
            }

            return { success: false, cancelled: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });
}
