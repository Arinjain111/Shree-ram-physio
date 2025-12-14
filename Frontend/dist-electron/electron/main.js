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
const schema_1 = require("./database/schema");
const syncEngine_1 = require("./sync/syncEngine");
let mainWindow = null;
let database = null;
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
electron_1.app.whenReady().then(() => {
    // Initialize database
    const dbPath = path.join(electron_1.app.getPath('userData'), 'shri-ram-physio.db');
    database = new schema_1.LocalDatabase(dbPath);
    // Initialize sync engine (update with your Azure backend URL)
    const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
    syncEngine = new syncEngine_1.SyncEngine(database, backendUrl);
    // Start auto-sync (every 5 minutes)
    syncEngine.startAutoSync();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Stop sync engine before quit
        if (syncEngine) {
            syncEngine.stopAutoSync();
        }
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// Handle print request
electron_1.ipcMain.handle('print-invoice', async (_event, htmlContent) => {
    try {
        const printWindow = new electron_1.BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
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
// Handle save invoice
electron_1.ipcMain.handle('save-invoice', async (_event, invoiceData) => {
    try {
        if (!database) {
            throw new Error('Database not initialized');
        }
        // Check if patient exists or create new
        let patientId;
        const existingPatient = database.getPatientByUHID(invoiceData.patient.uhid);
        if (existingPatient && existingPatient.id) {
            patientId = existingPatient.id;
            // Update patient info if changed
            database.updatePatient(patientId, {
                name: invoiceData.patient.name,
                age: invoiceData.patient.age,
                gender: invoiceData.patient.gender,
                phone: invoiceData.patient.phone,
                uhid: invoiceData.patient.uhid
            });
        }
        else {
            patientId = database.createPatient({
                name: invoiceData.patient.name,
                age: invoiceData.patient.age,
                gender: invoiceData.patient.gender,
                phone: invoiceData.patient.phone,
                uhid: invoiceData.patient.uhid
            });
        }
        // Create invoice
        const invoiceId = database.createInvoice({
            patient_id: patientId,
            invoice_number: invoiceData.invoiceNumber,
            date: invoiceData.date,
            diagnosis: invoiceData.diagnosis,
            total: invoiceData.total
        });
        // Create treatments
        for (const treatment of invoiceData.treatments) {
            database.createTreatment({
                invoice_id: invoiceId,
                name: treatment.name,
                sessions: treatment.sessions,
                start_date: treatment.startDate,
                end_date: treatment.endDate,
                amount: treatment.amount
            });
        }
        return { success: true, invoiceId };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// Handle load invoices
electron_1.ipcMain.handle('load-invoices', async () => {
    try {
        if (!database) {
            throw new Error('Database not initialized');
        }
        const invoices = database.getAllInvoices().map(invoice => {
            if (!database) {
                throw new Error('Database not initialized');
            }
            const patient = database.getPatient(invoice.patient_id);
            if (!patient) {
                throw new Error(`Patient ${invoice.patient_id} not found`);
            }
            const treatments = invoice.id ? database.getTreatmentsByInvoice(invoice.id) : [];
            return {
                invoiceNumber: invoice.invoice_number,
                date: invoice.date,
                patient: {
                    name: patient.name,
                    age: patient.age,
                    gender: patient.gender,
                    phone: patient.phone,
                    uhid: patient.uhid
                },
                diagnosis: invoice.diagnosis,
                treatments: treatments.map(t => ({
                    name: t.name,
                    sessions: t.sessions,
                    startDate: t.start_date,
                    endDate: t.end_date,
                    amount: t.amount
                })),
                total: invoice.total
            };
        });
        return { success: true, invoices };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// Handle save layout configuration
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
// Handle load layout configuration
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
// Handle file dialog for logo upload
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
// Handle manual sync trigger
electron_1.ipcMain.handle('sync-now', async () => {
    try {
        if (!syncEngine) {
            throw new Error('Sync engine not initialized');
        }
        const result = await syncEngine.performSync();
        return { success: true, result };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// Get sync status
electron_1.ipcMain.handle('get-sync-status', async () => {
    try {
        if (!database) {
            throw new Error('Database not initialized');
        }
        const pendingCount = database.getPendingRecords('patients').length +
            database.getPendingRecords('invoices').length +
            database.getPendingRecords('treatments').length;
        const lastSyncLog = database.getLastSyncLog();
        return {
            success: true,
            status: {
                pendingChanges: pendingCount,
                lastSync: lastSyncLog?.sync_date || null,
                lastSyncStatus: lastSyncLog?.sync_status || 'never'
            }
        };
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
// Create patient
electron_1.ipcMain.handle('create-patient', async (_event, patientData) => {
    try {
        if (!database) {
            throw new Error('Database not initialized');
        }
        const patientId = database.createPatient({
            name: patientData.name,
            age: patientData.age,
            gender: patientData.gender,
            phone: patientData.phone,
            uhid: patientData.uhid
        });
        return { success: true, patientId };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// Get all patients
electron_1.ipcMain.handle('get-patients', async () => {
    try {
        if (!database) {
            throw new Error('Database not initialized');
        }
        const patients = database.getAllPatients();
        return { success: true, patients };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// Get patient by ID
electron_1.ipcMain.handle('get-patient', async (_event, patientId) => {
    try {
        if (!database) {
            throw new Error('Database not initialized');
        }
        const patient = database.getPatient(patientId);
        if (!patient) {
            throw new Error('Patient not found');
        }
        return { success: true, patient };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// Search patients by name or UHID
electron_1.ipcMain.handle('search-patients', async (_event, query) => {
    try {
        if (!database) {
            throw new Error('Database not initialized');
        }
        const patients = database.searchPatients(query);
        return { success: true, patients };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// Update patient
electron_1.ipcMain.handle('update-patient', async (_event, patientId, patientData) => {
    try {
        if (!database) {
            throw new Error('Database not initialized');
        }
        database.updatePatient(patientId, {
            name: patientData.name,
            age: patientData.age,
            gender: patientData.gender,
            phone: patientData.phone,
            uhid: patientData.uhid
        });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
