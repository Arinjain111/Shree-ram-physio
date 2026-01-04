import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logError } from '../utils/errorLogger';
import { getSettings } from './settings';

export function registerPrintHandlers() {

    ipcMain.handle('print-invoice', async (_event, htmlContent: string) => {
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

    ipcMain.handle('print-invoice-and-preview', async (_event, htmlContent: string) => {
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

            // 1) Always show OS print dialog
            await new Promise<void>((resolve, reject) => {
                printWindow.webContents.print({
                    silent: false,
                    printBackground: true,
                    color: true,
                    margins: {
                        marginType: 'printableArea'
                    }
                }, (success: boolean, failureReason: string) => {
                    if (success) return resolve();
                    return reject(new Error(failureReason || 'Print failed'));
                });
            });

            // 2) Optionally auto-save PDF to selected folder
            let saved = false;
            let savedPath: string | undefined;
            try {
                const settings = getSettings();
                if (settings.autoSaveInvoicePdf) {
                    const saveDir = settings.invoiceSaveLocation;
                    fs.mkdirSync(saveDir, { recursive: true });

                    const rawNumber = String(invoiceData?.invoiceNumber ?? '').replace(/\D/g, '') || '0000';
                    const rawDate = String(invoiceData?.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
                    const fileName = `Invoice_${rawNumber}_${rawDate}.pdf`;
                    const filePath = path.join(saveDir, fileName);

                    const pdfBuffer = await printWindow.webContents.printToPDF({
                        printBackground: true,
                        preferCSSPageSize: true
                    });
                    fs.writeFileSync(filePath, pdfBuffer);
                    saved = true;
                    savedPath = filePath;
                }
            } catch (e) {
                // Do not fail printing if saving fails
                logError('Auto-save invoice PDF', e);
            } finally {
                printWindow.close();
            }

            return { success: true, saved, savedPath };
        } catch (error: any) {
            logError('Print and save invoice', error);
            return { success: false, saved: false, error: error.message };
        }
    });
}
