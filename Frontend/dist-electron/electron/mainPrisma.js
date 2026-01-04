"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
const electron_updater_1 = require("electron-updater");
const prisma_1 = require("./lib/prisma");
const initDatabase_1 = require("./lib/initDatabase");
const prismaSyncEngine_1 = require("./sync/prismaSyncEngine");
const errorLogger_1 = require("./utils/errorLogger");
const backend_1 = require("./config/backend");
const axios_1 = __importDefault(require("axios"));
// Early diagnostics
console.log('[Main] starting process', { pid: process.pid, argv: process.argv, cwd: process.cwd() });
// Suppress Node.js warnings
process.removeAllListeners('warning');
// Disable GPU acceleration to avoid driver issues (especially on some AMD GPUs)
electron_1.app.disableHardwareAcceleration();
electron_1.app.commandLine.appendSwitch('disable-gpu');
electron_1.app.commandLine.appendSwitch('disable-gpu-compositing');
// Global error handlers to avoid silent exits in dev
process.on('uncaughtException', (err) => {
    console.error('[Main] uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Main] unhandledRejection', reason);
});
dotenv.config();
// Global references
let mainWindow = null;
let prisma = null;
let syncEngine = null;
// Ensure single instance
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
function setupAutoUpdates() {
    electron_updater_1.autoUpdater.autoDownload = true;
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify().catch(() => {
        // ignore update errors to keep app running
    });
}
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
function loadDevUrl(url, retries = 0, maxRetries = 20) {
    if (!mainWindow)
        return;
    mainWindow.loadURL(url).catch((err) => {
        if (retries < maxRetries) {
            console.log(`[Main] Dev server not ready, retrying... (${retries + 1}/${maxRetries})`);
            setTimeout(() => loadDevUrl(url, retries + 1, maxRetries), 500);
        }
        else {
            console.error('[Main] Failed to load dev URL after max retries:', err);
            electron_1.dialog.showErrorBox('Dev Server Error', 'Failed to connect to Vite dev server on port 8080. Make sure Vite is running.');
        }
    });
}
function createWindow() {
    console.log('[Main] Creating main window. isDev=', isDev);
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false, // Allow ES modules from file:// protocol
        },
        icon: path.join(__dirname, '../assets/icon.png')
    });
    // Suppress unnecessary DevTools warnings
    mainWindow.webContents.on('console-message', (event, ...args) => {
        // Handle both old and new Electron versions
        const message = typeof args[0] === 'object' ? args[0].message : args[1];
        if (typeof message === 'string' && (message.includes('Autofill') || message.includes("wasn't found"))) {
            event.preventDefault();
        }
    });
    // Access directly (Vite replaces these identifiers at build time)
    const devServerUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL;
    let viteName = MAIN_WINDOW_VITE_NAME;
    // Fix for undefined viteName in packaged app
    if (!viteName || viteName === 'undefined') {
        console.log('[Main] viteName was undefined, enforcing "main_window"');
        viteName = 'main_window';
    }
    if (devServerUrl) {
        // Development mode - load from Vite dev server
        console.log('[Main] Loading dev URL:', devServerUrl);
        mainWindow.loadURL(devServerUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        // Production mode - load from built files
        const indexPath = path.join(__dirname, `../renderer/${viteName}/index.html`);
        console.log('[Main] Loading production index.html from:', indexPath);
        mainWindow.loadFile(indexPath);
        // Keep DevTools open for debugging
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    mainWindow.on('ready-to-show', () => {
        console.log('[Main] ready-to-show, showing window');
        mainWindow?.show();
    });
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[Main] did-finish-load');
    });
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error('[Main] did-fail-load', { errorCode, errorDescription, validatedURL });
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    setupAutoUpdates();
    // Initialize database tables (create if not exists)
    try {
        await (0, initDatabase_1.initializeDatabase)();
    }
    catch (error) {
        (0, errorLogger_1.logError)('Database initialization', error);
        electron_1.dialog.showErrorBox('Database Error', `Failed to initialize database: ${error.message}\n${error.stack || ''}`);
    }
    // Initialize Prisma Client (do not crash app on failure)
    try {
        prisma = (0, prisma_1.getPrismaClient)();
        // Verify foreign keys are enabled
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
        (0, errorLogger_1.logSuccess)('Prisma', 'Client initialized');
    }
    catch (error) {
        prisma = null;
        (0, errorLogger_1.logError)('Prisma initialization', error);
        electron_1.dialog.showErrorBox('Database Error', `Failed to initialize Prisma: ${error.message}\n${error.stack || ''}`);
    }
    // Initialize sync engine
    const backendUrl = (0, backend_1.getBackendUrl)();
    syncEngine = new prismaSyncEngine_1.PrismaSyncEngine(backendUrl);
    // Start auto-sync (every 5 minutes)
    syncEngine.startAutoSync();
    createWindow();
});
electron_1.app.on('before-quit', async (event) => {
    // Prevent default quit to do cleanup first
    if (syncEngine || prisma) {
        event.preventDefault();
        // Stop sync engine
        if (syncEngine) {
            syncEngine.stopAutoSync();
            syncEngine = null;
        }
        // Disconnect Prisma
        await (0, prisma_1.disconnectPrisma)();
        prisma = null;
        // Force quit after cleanup
        setImmediate(() => electron_1.app.exit(0));
    }
});
electron_1.app.on('window-all-closed', () => {
    // On macOS, apps stay open until explicitly quit
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// ============ SETTINGS MANAGEMENT ============
const settingsPath = path.join(electron_1.app.getPath('userData'), 'settings.json');
function getSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error('Error reading settings:', error);
    }
    // Default settings
    return {
        invoiceSaveLocation: path.join(electron_1.app.getPath('downloads'), 'Invoices')
    };
}
function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
    catch (error) {
        console.error('Error saving settings:', error);
    }
}
electron_1.ipcMain.handle('get-save-location', async () => {
    const settings = getSettings();
    return { success: true, location: settings.invoiceSaveLocation };
});
electron_1.ipcMain.handle('set-save-location', async (_event, location) => {
    try {
        const settings = getSettings();
        settings.invoiceSaveLocation = location;
        saveSettings(settings);
        return { success: true, location };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('choose-save-location', async () => {
    try {
        const result = await electron_1.dialog.showOpenDialog({
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
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// ============ PRINT HANDLER ============
electron_1.ipcMain.handle('print-invoice', async (_event, htmlContent, invoiceData) => {
    try {
        const printWindow = new electron_1.BrowserWindow({
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
        // Generate PDF and save it
        const settings = getSettings();
        const saveDir = settings.invoiceSaveLocation;
        // Ensure save directory exists
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
        // Generate filename: Invoice_<invoiceNumber>_<date>.pdf
        const invoiceNumber = invoiceData?.invoiceNumber || 'Unknown';
        const date = new Date().toISOString().split('T')[0];
        const filename = `Invoice_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${date}.pdf`;
        const savePath = path.join(saveDir, filename);
        // Print to PDF
        const pdfData = await printWindow.webContents.printToPDF({
            printBackground: true,
            margins: {
                marginType: 'none'
            },
            pageSize: 'A4'
        });
        fs.writeFileSync(savePath, pdfData);
        printWindow.close();
        return {
            success: true,
            saved: true,
            path: savePath,
            filename
        };
    }
    catch (error) {
        (0, errorLogger_1.logError)('Print invoice', error);
        return {
            success: false,
            saved: false,
            error: error.message
        };
    }
});
electron_1.ipcMain.handle('print-invoice-and-preview', async (_event, htmlContent, invoiceData) => {
    try {
        const printWindow = new electron_1.BrowserWindow({
            show: true,
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
            }, (success, failureReason) => {
                printWindow.close();
                if (success) {
                    resolve({ success: true });
                }
                else {
                    reject({ success: false, error: failureReason });
                }
            });
        });
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('print-invoice-save-and-preview', async (_event, htmlContent, invoiceData) => {
    try {
        // First, save as PDF
        const settings = getSettings();
        const saveDir = settings.invoiceSaveLocation;
        // Ensure save directory exists
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
        // Generate filename
        const invoiceNumber = invoiceData?.invoiceNumber || 'Unknown';
        const date = new Date().toISOString().split('T')[0];
        const filename = `Invoice_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${date}.pdf`;
        const savePath = path.join(saveDir, filename);
        // Create a hidden window for PDF generation
        const pdfWindow = new electron_1.BrowserWindow({
            show: false,
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        // Generate and save PDF
        const pdfData = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            margins: {
                marginType: 'none'
            },
            pageSize: 'A4'
        });
        fs.writeFileSync(savePath, pdfData);
        pdfWindow.close();
        // Now show print dialog
        const printWindow = new electron_1.BrowserWindow({
            show: true,
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
            }, (success, failureReason) => {
                printWindow.close();
                if (success) {
                    resolve({ success: true, saved: true, filename, path: savePath });
                }
                else {
                    reject({ success: false, error: failureReason, saved: true, filename, path: savePath });
                }
            });
        });
    }
    catch (error) {
        (0, errorLogger_1.logError)('Print and save invoice', error);
        return { success: false, saved: false, error: error.message };
    }
});
// ============ INVOICE HANDLERS ============
electron_1.ipcMain.handle('save-invoice', async (_event, invoiceData) => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        // Validate invoice data using Zod
        const { InvoiceDataSchema, validateData } = await Promise.resolve().then(() => __importStar(require('../src/schemas/validation.schema')));
        const validation = validateData(InvoiceDataSchema, invoiceData);
        if (!validation.success) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }
        const validatedData = validation.data;
        // Check if patient exists or create new
        let patient = await prisma.patient.findUnique({
            where: { uhid: validatedData.patient.uhid }
        });
        if (patient) {
            // Update patient info if changed
            patient = await prisma.patient.update({
                where: { id: patient.id },
                data: {
                    firstName: validatedData.patient.firstName,
                    lastName: validatedData.patient.lastName,
                    age: validatedData.patient.age,
                    gender: validatedData.patient.gender,
                    phone: validatedData.patient.phone,
                    syncStatus: 'PENDING'
                }
            });
        }
        else {
            // Create new patient
            patient = await prisma.patient.create({
                data: {
                    firstName: validatedData.patient.firstName,
                    lastName: validatedData.patient.lastName,
                    age: validatedData.patient.age,
                    gender: validatedData.patient.gender,
                    phone: validatedData.patient.phone,
                    uhid: validatedData.patient.uhid,
                    syncStatus: 'PENDING'
                }
            });
        }
        // Convert total to number if it's a string
        const totalAmount = typeof validatedData.total === 'string'
            ? parseFloat(validatedData.total)
            : validatedData.total;
        // Create invoice
        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber: validatedData.invoiceNumber,
                patientId: patient.id,
                date: validatedData.date,
                diagnosis: validatedData.diagnosis || '',
                notes: validatedData.notes || '',
                paymentMethod: validatedData.paymentMethod || 'Cash',
                total: totalAmount,
                syncStatus: 'PENDING'
            }
        });
        // Create treatments
        for (const treatment of validatedData.treatments) {
            await prisma.treatment.create({
                data: {
                    invoiceId: invoice.id,
                    name: treatment.name,
                    duration: treatment.duration || '',
                    sessions: treatment.sessions,
                    startDate: treatment.startDate,
                    endDate: treatment.endDate,
                    amount: treatment.amount,
                    syncStatus: 'PENDING'
                }
            });
        }
        return { success: true, invoiceId: invoice.id };
    }
    catch (error) {
        (0, errorLogger_1.logError)('Save invoice', error);
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('load-invoices', async () => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const invoices = await prisma.invoice.findMany({
            include: {
                patient: true,
                treatments: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        const formattedInvoices = invoices.map(invoice => ({
            id: invoice.id,
            patientId: invoice.patientId,
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.date,
            patient: {
                id: invoice.patient.id,
                firstName: invoice.patient.firstName,
                lastName: invoice.patient.lastName,
                age: invoice.patient.age,
                gender: invoice.patient.gender,
                phone: invoice.patient.phone,
                uhid: invoice.patient.uhid,
                syncStatus: invoice.patient.syncStatus,
                cloudId: invoice.patient.cloudId
            },
            diagnosis: invoice.diagnosis,
            treatments: invoice.treatments.map(t => ({
                name: t.name,
                sessions: t.sessions,
                startDate: t.startDate,
                endDate: t.endDate,
                amount: t.amount
            })),
            total: invoice.total,
            syncStatus: invoice.syncStatus,
            cloudId: invoice.cloudId,
            lastSyncAt: invoice.lastSyncAt
        }));
        return { success: true, invoices: formattedInvoices };
    }
    catch (error) {
        (0, errorLogger_1.logError)('Load invoices', error);
        return { success: false, error: String(error) };
    }
});
// Load all patients
electron_1.ipcMain.handle('load-patients', async () => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const patients = await prisma.patient.findMany({
            orderBy: {
                updatedAt: 'desc'
            }
        });
        return { success: true, patients };
    }
    catch (error) {
        (0, errorLogger_1.logError)('Load patients', error);
        return { success: false, error: String(error) };
    }
});
// Get next invoice number from backend
electron_1.ipcMain.handle('get-next-invoice-number', async () => {
    try {
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        let backendNextNumber = 0;
        // 1. Try to fetch from backend
        try {
            const response = await axios_1.default.get(`${backendUrl}/api/invoices/next-number`, {
                timeout: 3000 // Short timeout to not block UI
            });
            if (response.data.success && response.data.invoiceNumber) {
                // Assume numeric 0001 format
                const match = response.data.invoiceNumber.match(/(\d+)$/);
                if (match) {
                    backendNextNumber = parseInt(match[1], 10);
                }
            }
        }
        catch (e) {
            (0, errorLogger_1.logWarning)('Invoice number', 'Backend unavailable, checking local ONLY');
        }
        // 2. Check Local Database
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const lastInvoice = await prisma.invoice.findFirst({
            orderBy: { invoiceNumber: 'desc' },
            select: { invoiceNumber: true }
        });
        let localMax = 0;
        if (lastInvoice && lastInvoice.invoiceNumber) {
            const match = lastInvoice.invoiceNumber.match(/(\d+)$/);
            if (match) {
                localMax = parseInt(match[1], 10);
            }
        }
        // 3. Determine actual next number
        // If backend gave us "Next Number", it means (backendMax + 1).
        // If we have localMax, we want (localMax + 1).
        // So we should compare (backendNextNumber) vs (localMax + 1).
        // Actually, let's treat backendNextNumber as the candidate.
        // If localMax >= backendNextNumber, then backend is stale or valid but behind local offline work.
        // Example: Backend says next is 105. Local has 105 saved offline. Local max is 105. Next should be 106.
        // So we want (localMax + 1).
        // Example: Backend says next is 105. Local has 100. Next is 105.
        const nextNumVal = Math.max(backendNextNumber, localMax + 1);
        const nextNumber = nextNumVal.toString().padStart(4, '0');
        return {
            success: true,
            invoiceNumber: nextNumber,
            source: nextNumVal > backendNextNumber ? 'local-conflict-resolved' : 'backend' // Info purposes
        };
    }
    catch (error) {
        (0, errorLogger_1.logError)('Invoice number', error);
        // Fallback
        return {
            success: false,
            error: String(error),
            invoiceNumber: '0001',
            source: 'fallback'
        };
    }
});
// ============ LAYOUT HANDLERS ============
electron_1.ipcMain.handle('save-layout', async (_event, layoutConfig) => {
    try {
        const configDir = path.join(electron_1.app.getPath('userData'), 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const filePath = path.join(configDir, 'invoice-layout.json');
        fs.writeFileSync(filePath, JSON.stringify(layoutConfig, null, 2));
        return { success: true };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('load-layout', async () => {
    try {
        const configDir = path.join(electron_1.app.getPath('userData'), 'config');
        const filePath = path.join(configDir, 'invoice-layout.json');
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return { success: true, layout: JSON.parse(content) };
        }
        else {
            return { success: true, layout: null };
        }
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('select-logo', async () => {
    try {
        const result = await electron_1.dialog.showOpenDialog({
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
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// ============ SYNC HANDLERS ============
electron_1.ipcMain.handle('sync-now', async () => {
    try {
        if (!syncEngine) {
            throw new Error('Sync engine not initialized');
        }
        const result = await syncEngine.performSync(true);
        // Reset auto-sync timer after manual sync (restart 5-minute countdown)
        if (result.success) {
            syncEngine.resetAutoSyncTimer(5 * 60 * 1000); // 5 minutes
        }
        return { success: true, result };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('force-sync-push', async () => {
    try {
        if (!prisma)
            throw new Error('Prisma not initialized');
        console.log('⚠️ Forcing all local records to PENDING...');
        const p = await prisma.patient.updateMany({
            where: { cloudId: null },
            data: { syncStatus: 'PENDING' }
        });
        const i = await prisma.invoice.updateMany({
            where: { cloudId: null },
            data: { syncStatus: 'PENDING' }
        });
        const t = await prisma.treatment.updateMany({
            where: { cloudId: null },
            data: { syncStatus: 'PENDING' }
        });
        console.log(`Updated status to PENDING: ${p.count} patients, ${i.count} invoices, ${t.count} treatments`);
        // Trigger sync immediately
        if (syncEngine) {
            return syncEngine.performSync(true);
        }
        return { success: true, message: `Ready to sync: ${p.count} patients, ${i.count} invoices` };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('get-sync-status', async () => {
    try {
        if (!syncEngine) {
            throw new Error('Sync engine not initialized');
        }
        const status = await syncEngine.getSyncStatus();
        return { success: true, status };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// ============ DATABASE RESET HANDLERS ============
electron_1.ipcMain.handle('reset-local-database', async () => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        console.log('⚠️  Resetting local database...');
        // Delete all records in transaction
        await prisma.$transaction(async (tx) => {
            const deletedTreatments = await tx.treatment.deleteMany();
            console.log(`   Deleted ${deletedTreatments.count} treatments`);
            const deletedInvoices = await tx.invoice.deleteMany();
            console.log(`   Deleted ${deletedInvoices.count} invoices`);
            const deletedPatients = await tx.patient.deleteMany();
            console.log(`   Deleted ${deletedPatients.count} patients`);
            const deletedPresets = await tx.treatmentPreset.deleteMany();
            console.log(`   Deleted ${deletedPresets.count} treatment presets`);
        });
        console.log('✅ Local database reset successfully');
        return { success: true, message: 'Local database reset successfully' };
    }
    catch (error) {
        (0, errorLogger_1.logError)('Reset local database', error);
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('reset-cloud-database', async () => {
    try {
        const backendUrl = (0, backend_1.getBackendUrl)();
        const axios = require('axios');
        console.log(`⚠️  Resetting cloud database via backend: ${backendUrl}`);
        const response = await axios.post(`${backendUrl}/api/database/reset`, {}, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.data.success) {
            console.log('✅ Cloud database reset successfully');
            return { success: true, message: 'Cloud database reset successfully' };
        }
        else {
            throw new Error(response.data.error || 'Failed to reset cloud database');
        }
    }
    catch (error) {
        console.error('Cloud database reset error:', error.response?.data || error.message);
        (0, errorLogger_1.logError)('Reset cloud database', error);
        return {
            success: false,
            error: error.response?.data?.error || error.message || String(error)
        };
    }
});
electron_1.ipcMain.handle('reset-all-databases', async () => {
    try {
        console.log('⚠️  Resetting both local and cloud databases...');
        // IMPORTANT: Stop auto-sync during reset to prevent data from syncing back
        if (syncEngine) {
            console.log('   ⏸️  Pausing auto-sync during reset...');
            syncEngine.stopAutoSync();
        }
        // Step 1: Reset CLOUD database FIRST (so it doesn't sync back)
        const backendUrl = (0, backend_1.getBackendUrl)();
        const axios = require('axios');
        console.log(`   1️⃣ Resetting cloud database via: ${backendUrl}`);
        try {
            const cloudResponse = await axios.post(`${backendUrl}/api/database/reset`, {}, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!cloudResponse.data.success) {
                throw new Error(cloudResponse.data.error || 'Failed to reset cloud database');
            }
            console.log('   ✅ Cloud database reset successfully');
        }
        catch (cloudError) {
            console.error('   ❌ Cloud database reset failed:', cloudError.response?.data || cloudError.message);
            throw new Error(`Cloud reset failed: ${cloudError.response?.data?.error || cloudError.message}`);
        }
        // Step 2: Reset LOCAL database
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        console.log('   2️⃣ Resetting local database...');
        await prisma.$transaction(async (tx) => {
            const deletedTreatments = await tx.treatment.deleteMany();
            console.log(`      ✓ Deleted ${deletedTreatments.count} local treatments`);
            const deletedInvoices = await tx.invoice.deleteMany();
            console.log(`      ✓ Deleted ${deletedInvoices.count} local invoices`);
            const deletedPatients = await tx.patient.deleteMany();
            console.log(`      ✓ Deleted ${deletedPatients.count} local patients`);
            const deletedPresets = await tx.treatmentPreset.deleteMany();
            console.log(`      ✓ Deleted ${deletedPresets.count} local treatment presets`);
        });
        console.log('   ✅ Local database reset successfully');
        // Step 3: Wait a moment to ensure everything is committed
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Step 4: Resume auto-sync
        if (syncEngine) {
            console.log('   ▶️  Resuming auto-sync...');
            syncEngine.startAutoSync(30 * 60 * 1000); // 30 minutes
        }
        console.log('✅ All databases reset successfully');
        return {
            success: true,
            message: 'All databases (local and cloud) reset successfully'
        };
    }
    catch (error) {
        // Resume auto-sync even if reset failed
        if (syncEngine) {
            syncEngine.startAutoSync(30 * 60 * 1000);
        }
        console.error('❌ Reset all databases failed:', error);
        (0, errorLogger_1.logError)('Reset all databases', error);
        return {
            success: false,
            error: error.response?.data?.error || error.message || String(error)
        };
    }
});
electron_1.ipcMain.handle('get-database-stats', async () => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const [patients, invoices, treatments, treatmentPresets] = await Promise.all([
            prisma.patient.count(),
            prisma.invoice.count(),
            prisma.treatment.count(),
            prisma.treatmentPreset.count()
        ]);
        console.log(`📊 Database stats: ${patients} patients, ${invoices} invoices, ${treatments} treatments, ${treatmentPresets} presets`);
        return {
            success: true,
            stats: {
                patients,
                invoices,
                treatments,
                treatmentPresets
            }
        };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// ============ PATIENT HANDLERS ============
electron_1.ipcMain.handle('create-patient', async (_event, patientData) => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const patient = await prisma.patient.create({
            data: {
                firstName: patientData.firstName,
                lastName: patientData.lastName,
                age: patientData.age,
                gender: patientData.gender,
                phone: patientData.phone,
                uhid: patientData.uhid,
                syncStatus: 'PENDING'
            }
        });
        return { success: true, patientId: patient.id };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('get-patients', async () => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const patients = await prisma.patient.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, patients };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('get-patient', async (_event, patientId) => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const patient = await prisma.patient.findUnique({
            where: { id: patientId }
        });
        if (!patient) {
            throw new Error('Patient not found');
        }
        return { success: true, patient };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('delete-patient', async (_event, patientId, target) => {
    try {
        if (!prisma)
            throw new Error('Prisma not initialized');
        const result = { local: false, cloud: false, errors: [] };
        // 1. Delete from Cloud
        if (target === 'cloud' || target === 'both') {
            try {
                const patient = await prisma.patient.findUnique({ where: { id: patientId } });
                if (patient && patient.cloudId) {
                    const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
                    const axios = require('axios');
                    await axios.delete(`${backendUrl}/api/patients/${patient.cloudId}`);
                    result.cloud = true;
                }
                else if (target === 'cloud') {
                    throw new Error('Patient not synced to cloud (no Cloud ID)');
                }
            }
            catch (e) {
                console.error('Cloud delete failed', e);
                result.errors.push(`Cloud: ${e.message}`);
            }
        }
        // 2. Delete from Local
        if (target === 'local' || target === 'both') {
            try {
                await prisma.patient.delete({ where: { id: patientId } });
                result.local = true;
            }
            catch (e) {
                console.error('Local delete failed', e);
                result.errors.push(`Local: ${e.message}`);
            }
        }
        return { success: result.local || result.cloud, ...result };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('search-patients', async (_event, query) => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const patients = await prisma.patient.findMany({
            where: {
                OR: [
                    { firstName: { contains: query } },
                    { lastName: { contains: query } },
                    { uhid: { contains: query } }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, patients };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('update-patient', async (_event, patientId, patientData) => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        await prisma.patient.update({
            where: { id: patientId },
            data: {
                firstName: patientData.firstName,
                lastName: patientData.lastName,
                age: patientData.age,
                gender: patientData.gender,
                phone: patientData.phone,
                uhid: patientData.uhid,
                syncStatus: 'PENDING'
            }
        });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// Treatment Preset Handlers
electron_1.ipcMain.handle('load-treatment-presets', async () => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const presets = await prisma.treatmentPreset.findMany({
            orderBy: { name: 'asc' }
        });
        return { success: true, presets };
    }
    catch (error) {
        return { success: false, error: String(error), presets: [] };
    }
});
// Sync presets from cloud to local database
electron_1.ipcMain.handle('sync-presets-from-cloud', async () => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        const axios = require('axios');
        // Fetch presets from cloud
        const response = await axios.get(`${backendUrl}/api/presets`, {
            timeout: 10000
        });
        if (!response.data.success || !Array.isArray(response.data.presets)) {
            throw new Error('Invalid response from server');
        }
        const cloudPresets = response.data.presets;
        const stats = {
            fetched: cloudPresets.length,
            created: 0,
            updated: 0,
            unchanged: 0
        };
        // Merge cloud presets with local database
        for (const cloudPreset of cloudPresets) {
            // Check if preset exists locally by name (presets don't have cloudId field)
            const localPreset = await prisma.treatmentPreset.findFirst({
                where: {
                    name: cloudPreset.name
                }
            });
            if (localPreset) {
                // Update if different
                const needsUpdate = localPreset.defaultSessions !== cloudPreset.defaultSessions ||
                    localPreset.pricePerSession !== cloudPreset.pricePerSession;
                if (needsUpdate) {
                    await prisma.treatmentPreset.update({
                        where: { id: localPreset.id },
                        data: {
                            defaultSessions: cloudPreset.defaultSessions,
                            pricePerSession: cloudPreset.pricePerSession
                        }
                    });
                    stats.updated++;
                    (0, errorLogger_1.logInfo)('Preset sync', `Updated: ${cloudPreset.name}`);
                }
                else {
                    stats.unchanged++;
                }
            }
            else {
                // Create new preset
                await prisma.treatmentPreset.create({
                    data: {
                        name: cloudPreset.name,
                        defaultSessions: cloudPreset.defaultSessions,
                        pricePerSession: cloudPreset.pricePerSession
                    }
                });
                stats.created++;
                (0, errorLogger_1.logInfo)('Preset sync', `Created: ${cloudPreset.name}`);
            }
        }
        (0, errorLogger_1.logSuccess)('Preset sync', `${stats.created} created, ${stats.updated} updated`);
        return { success: true, stats };
    }
    catch (error) {
        (0, errorLogger_1.logError)('Preset sync', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            stats: { fetched: 0, created: 0, updated: 0, unchanged: 0 }
        };
    }
});
electron_1.ipcMain.handle('add-treatment-preset', async (_event, presetData) => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        // Create locally first
        const preset = await prisma.treatmentPreset.create({
            data: {
                name: presetData.name,
                defaultSessions: presetData.defaultSessions,
                pricePerSession: presetData.pricePerSession
            }
        });
        // Sync to cloud in background (using bulk sync for upsert by name behavior)
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        try {
            await axios_1.default.post(`${backendUrl}/api/presets/sync`, {
                presets: [{
                        name: preset.name,
                        defaultSessions: preset.defaultSessions,
                        pricePerSession: preset.pricePerSession
                    }]
            }, {
                timeout: 5000
            });
            (0, errorLogger_1.logInfo)('Cloud sync', `Preset uploaded: ${preset.name}`);
        }
        catch (syncError) {
            console.warn('⚠️ Failed to sync preset to cloud (will retry later):', syncError);
            // Don't fail the operation if cloud sync fails - local data is saved
        }
        return { success: true, preset };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('update-treatment-preset', async (_event, { id, ...presetData }) => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        // Update locally first
        const preset = await prisma.treatmentPreset.update({
            where: { id },
            data: {
                name: presetData.name,
                defaultSessions: presetData.defaultSessions,
                pricePerSession: presetData.pricePerSession
            }
        });
        // Sync to cloud in background (using bulk sync for upsert by name behavior)
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        try {
            // Use sync endpoint which matches by NAME, avoiding ID mismatch
            await axios_1.default.post(`${backendUrl}/api/presets/sync`, {
                presets: [{
                        name: preset.name,
                        defaultSessions: preset.defaultSessions,
                        pricePerSession: preset.pricePerSession
                    }]
            }, {
                timeout: 5000
            });
            (0, errorLogger_1.logInfo)('Cloud sync', `Preset updated: ${preset.name}`);
        }
        catch (syncError) {
            console.warn('⚠️ Failed to update preset in cloud (will retry later):', syncError);
            // Don't fail the operation if cloud sync fails - local data is saved
        }
        return { success: true, preset };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle('delete-treatment-preset', async (_event, id) => {
    try {
        if (!prisma) {
            throw new Error('Prisma not initialized');
        }
        // 1. Get the preset name before deleting locally
        const presetToDelete = await prisma.treatmentPreset.findUnique({
            where: { id }
        });
        if (!presetToDelete) {
            throw new Error('Preset not found locally');
        }
        const presetName = presetToDelete.name;
        // 2. Delete locally
        await prisma.treatmentPreset.delete({
            where: { id }
        });
        // 3. Sync deletion to cloud in background
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        try {
            // Find the preset on cloud by name to get its Cloud ID
            const cloudPresetsRes = await axios_1.default.get(`${backendUrl}/api/presets`, { timeout: 10000 });
            if (cloudPresetsRes.data.success && Array.isArray(cloudPresetsRes.data.presets)) {
                const cloudPreset = cloudPresetsRes.data.presets.find((p) => p.name === presetName);
                if (cloudPreset) {
                    await axios_1.default.delete(`${backendUrl}/api/presets/${cloudPreset.id}`, {
                        timeout: 5000
                    });
                    (0, errorLogger_1.logInfo)('Cloud sync', `Preset '${presetName}' deleted from cloud`);
                }
                else {
                    console.warn(`Could not find preset '${presetName}' on cloud to delete`);
                }
            }
        }
        catch (syncError) {
            console.warn('⚠️ Failed to delete preset from cloud:', syncError);
            // Don't fail the operation if cloud sync fails - local data is deleted
        }
        return { success: true };
    }
    catch (error) {
        console.error('Failed to delete preset', error);
        return { success: false, error: String(error) };
    }
});
