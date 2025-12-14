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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const prisma_1 = require("./lib/prisma");
const initDatabase_1 = require("./lib/initDatabase");
const prismaSyncEngine_1 = require("./sync/prismaSyncEngine");
const errorLogger_1 = require("./utils/errorLogger");
// Suppress Node.js warnings
process.removeAllListeners('warning');
let mainWindow = null;
let prisma = null;
let syncEngine = null;
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
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
    if (isDev) {
        mainWindow.loadURL('http://localhost:8080');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    // Initialize database tables (create if not exists)
    try {
        await (0, initDatabase_1.initializeDatabase)();
    }
    catch (error) {
        (0, errorLogger_1.logError)('Database initialization', error);
        electron_1.dialog.showErrorBox('Database Error', 'Failed to initialize database. Please restart the application.');
    }
    // Initialize Prisma Client
    prisma = (0, prisma_1.getPrismaClient)();
    // Verify foreign keys are enabled
    try {
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
        (0, errorLogger_1.logSuccess)('Prisma', 'Client initialized');
    }
    catch (error) {
        (0, errorLogger_1.logError)('Prisma initialization', error);
    }
    // Initialize sync engine
    const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
    syncEngine = new prismaSyncEngine_1.PrismaSyncEngine(backendUrl);
    // Start auto-sync (every 5 minutes)
    syncEngine.startAutoSync();
    createWindow();
});
electron_1.app.on('window-all-closed', async () => {
    if (process.platform !== 'darwin') {
        // Stop sync engine before quit
        if (syncEngine) {
            syncEngine.stopAutoSync();
        }
        // Disconnect Prisma
        await (0, prisma_1.disconnectPrisma)();
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// ============ PRINT HANDLER ============
electron_1.ipcMain.handle('print-invoice', async (_event, htmlContent) => {
    try {
        const printWindow = new electron_1.BrowserWindow({
            show: true, // Must be visible for print preview to work
            width: 1200,
            height: 800,
            x: -10000, // Move off-screen to avoid flickering
            y: -10000,
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
        const axios = require('axios');
        // Try to fetch from backend
        const response = await axios.get(`${backendUrl}/api/invoices/next-number`, {
            timeout: 5000
        });
        if (response.data.success && response.data.invoiceNumber) {
            return {
                success: true,
                invoiceNumber: response.data.invoiceNumber,
                source: 'backend'
            };
        }
        else {
            throw new Error('Invalid response from backend');
        }
    }
    catch (error) {
        (0, errorLogger_1.logWarning)('Invoice number', 'Backend unavailable, using local generation');
        // Fallback: Generate from local database
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }
            const lastInvoice = await prisma.invoice.findFirst({
                orderBy: { invoiceNumber: 'desc' },
                select: { invoiceNumber: true }
            });
            let maxNum = 0;
            if (lastInvoice && lastInvoice.invoiceNumber) {
                const match = lastInvoice.invoiceNumber.match(/^\d+$/);
                if (match) {
                    maxNum = parseInt(match[0], 10);
                }
            }
            const nextNumber = (maxNum + 1).toString().padStart(4, '0');
            return {
                success: true,
                invoiceNumber: nextNumber,
                source: 'local'
            };
        }
        catch (localError) {
            return {
                success: false,
                error: String(localError),
                invoiceNumber: '0001',
                source: 'fallback'
            };
        }
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
        const result = await syncEngine.performSync();
        // Reset auto-sync timer after manual sync (restart 30-minute countdown)
        if (result.success) {
            syncEngine.resetAutoSyncTimer(30 * 60 * 1000); // 30 minutes
        }
        return { success: true, result };
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
// Backend & database status for renderer (Home page indicator)
electron_1.ipcMain.handle('get-backend-status', async () => {
    try {
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        const axios = require('axios');
        const response = await axios.get(`${backendUrl}/health`, { timeout: 5000 });
        const data = response.data || {};
        const backendStatus = 'up';
        const databaseStatus = data?.database?.status === 'down' ? 'down' : 'up';
        return {
            success: true,
            status: {
                backend: backendStatus,
                database: databaseStatus,
                raw: data,
            },
        };
    }
    catch (error) {
        return {
            success: true,
            status: {
                backend: 'down',
                database: 'unknown',
                error: error instanceof Error ? error.message : String(error),
            },
        };
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
        // Sync to cloud in background
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        const axios = require('axios');
        try {
            await axios.post(`${backendUrl}/api/presets`, {
                name: preset.name,
                defaultSessions: preset.defaultSessions,
                pricePerSession: preset.pricePerSession
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
        // Sync to cloud in background
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        const axios = require('axios');
        try {
            await axios.put(`${backendUrl}/api/presets/${id}`, {
                name: preset.name,
                defaultSessions: preset.defaultSessions,
                pricePerSession: preset.pricePerSession
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
        // Delete locally first
        await prisma.treatmentPreset.delete({
            where: { id }
        });
        // Sync deletion to cloud in background
        const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
        const axios = require('axios');
        try {
            await axios.delete(`${backendUrl}/api/presets/${id}`, {
                timeout: 5000
            });
            (0, errorLogger_1.logInfo)('Cloud sync', 'Preset deleted from cloud');
        }
        catch (syncError) {
            console.warn('⚠️ Failed to delete preset from cloud:', syncError);
            // Don't fail the operation if cloud sync fails - local data is deleted
        }
        return { success: true };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
