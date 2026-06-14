import { ipcMain, BrowserWindow, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logError } from '../utils/errorLogger';
import { getSettings } from './settings';

/**
 * Web-prefs for every print / preview BrowserWindow.
 *
 * SECURITY (was 🔴 Critical in FEATURES_ROADMAP.md):
 *  - `nodeIntegration: false` — these windows never need Node APIs
 *  - `contextIsolation: true`  — keeps the renderer's main world isolated
 *    from any future preload; a misbehaving print template can't reach
 *    `process` / `require` anymore
 *  - `sandbox: true`            — sandbox the renderer so it can't escape
 *    even if a template injected hostile markup
 *  - `preload: undefined`       — there's no preload script because
 *    these windows just render the invoice HTML and call `webContents.print`
 *    / `printToPDF` from the main process; they don't need any IPC bridge
 */
const PRINT_WEB_PREFS: Electron.WebPreferences = {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    javascript: true, // the invoice HTML may include <script> blocks for layout
};

export function registerPrintHandlers() {

    ipcMain.handle('print-invoice', async (_event, htmlContent: string) => {
        try {
            const printWindow = new BrowserWindow({
                show: false,
                width: 1200,
                height: 800,
                webPreferences: PRINT_WEB_PREFS,
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
                webPreferences: PRINT_WEB_PREFS,
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

    ipcMain.handle('print-invoice-save-and-preview', async (_event, htmlContent: string, invoiceData: any, paperConfig?: { paperSize?: string; paperOrientation?: string }) => {
        try {
            const printWindow = new BrowserWindow({
                show: false,
                width: 1200,
                height: 800,
                webPreferences: PRINT_WEB_PREFS,
            });

            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Calculate page size in microns for the OS print dialog
            // A4 = 210mm x 297mm, A5 = 148mm x 210mm
            const PAPER_MICRONS: Record<string, { portrait: { width: number; height: number }; landscape: { width: number; height: number } }> = {
                A4: {
                    portrait:  { width: 210000, height: 297000 },
                    landscape: { width: 297000, height: 210000 },
                },
                A5: {
                    portrait:  { width: 148000, height: 210000 },
                    landscape: { width: 210000, height: 148000 },
                },
            };
            const size = paperConfig?.paperSize || 'A4';
            const orient = paperConfig?.paperOrientation || 'portrait';
            const pageSize = PAPER_MICRONS[size]?.[orient as 'portrait' | 'landscape'] ?? PAPER_MICRONS.A4.portrait;

            // 1) Always show OS print dialog
            await new Promise<void>((resolve, reject) => {
                printWindow.webContents.print({
                    silent: false,
                    printBackground: true,
                    color: true,
                    pageSize,
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

    ipcMain.handle('preview-only', async (_event, htmlContent: string, paperConfig?: { paperSize?: string; paperOrientation?: string }) => {
        try {
            const printWindow = new BrowserWindow({
                show: false,
                width: 1200,
                height: 800,
                webPreferences: PRINT_WEB_PREFS,
            });

            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Set page size for PDF generation
            const isA5 = paperConfig?.paperSize === 'A5';
            const isLandscape = paperConfig?.paperOrientation === 'landscape';
            const pageSize = isA5 ? 'A5' : 'A4';

            const pdfBuffer = await printWindow.webContents.printToPDF({
                printBackground: true,
                preferCSSPageSize: true,
                pageSize: pageSize,
                landscape: isLandscape,
            });

            const tempFilePath = path.join(os.tmpdir(), `Invoice_Preview_${Date.now()}.pdf`);
            fs.writeFileSync(tempFilePath, pdfBuffer);

            printWindow.close();

            // Open PDF with default system viewer
            await shell.openPath(tempFilePath);

            return { success: true };
        } catch (error: any) {
            logError('Preview only', error);
            return { success: false, error: error.message };
        }
    });
}
