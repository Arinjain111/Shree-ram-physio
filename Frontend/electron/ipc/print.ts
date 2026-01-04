import { ipcMain, BrowserWindow } from 'electron';
import { logError } from '../utils/errorLogger';

export function registerPrintHandlers() {

    ipcMain.handle('print-invoice', async (_event, htmlContent: string, invoiceData: any) => {
        try {
            const printWindow = new BrowserWindow({
                show: false,
                width: 1200,
                height: 800,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });

            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

            // Ensure content is fully rendered
            await new Promise(resolve => setTimeout(resolve, 500));

            // Use OS print dialog, no PDF save
            await new Promise<void>((resolve, reject) => {
                printWindow.webContents.print({
                    silent: false,
                    printBackground: true,
                    color: true,
                    margins: { marginType: 'printableArea' }
                }, (success, failureReason) => {
                    printWindow.close();
                    if (success) return resolve();
                    return reject(new Error(failureReason || 'Print failed'));
                });
            });

            return { success: true, saved: false };
        } catch (error: any) {
            logError('Print invoice', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle('print-invoice-and-preview', async (_event, htmlContent: string, invoiceData: any) => {
        try {
            const printWindow = new BrowserWindow({
                show: false,
                width: 1200,
                height: 800,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });

            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

            // Ensure content is fully rendered before printing
            await new Promise(resolve => setTimeout(resolve, 500));

            return new Promise((resolve, reject) => {
                printWindow.webContents.print({
                    silent: false,
                    printBackground: true,
                    color: true,
                    margins: {
                        marginType: 'printableArea'
                    }
                }, (success: boolean, failureReason: string) => {
                    printWindow.close();
                    if (success) {
                        resolve({ success: true });
                    } else {
                        reject({ success: false, error: failureReason });
                    }
                });
            });
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('print-invoice-save-and-preview', async (_event, htmlContent: string, invoiceData: any) => {
        try {
            const printWindow = new BrowserWindow({
                show: false,
                width: 1200,
                height: 800,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });

            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
            await new Promise(resolve => setTimeout(resolve, 500));

            return new Promise((resolve, reject) => {
                printWindow.webContents.print({
                    silent: false,
                    printBackground: true,
                    color: true,
                    margins: {
                        marginType: 'printableArea'
                    }
                }, (success: boolean, failureReason: string) => {
                    printWindow.close();
                    if (success) {
                        resolve({ success: true, saved: false });
                    } else {
                        reject({ success: false, error: failureReason, saved: false });
                    }
                });
            });
        } catch (error: any) {
            logError('Print and save invoice', error);
            return { success: false, saved: false, error: error.message };
        }
    });
}
