import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { LocalDatabase } from './database/schema';
import { SyncEngine } from './sync/syncEngine';

let mainWindow: BrowserWindow | null = null;
let database: LocalDatabase | null = null;
let syncEngine: SyncEngine | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
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
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  const dbPath = path.join(app.getPath('userData'), 'shri-ram-physio.db');
  database = new LocalDatabase(dbPath);
  
  // Initialize sync engine (update with your Azure backend URL)
  const backendUrl = process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
  syncEngine = new SyncEngine(database, backendUrl);
  
  // Start auto-sync (every 5 minutes)
  syncEngine.startAutoSync();
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Stop sync engine before quit
    if (syncEngine) {
      syncEngine.stopAutoSync();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle print request
ipcMain.handle('print-invoice', async (_event, htmlContent: string) => {
  try {
    const printWindow = new BrowserWindow({
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

// Handle save invoice
ipcMain.handle('save-invoice', async (_event, invoiceData: any) => {
  try {
    if (!database) {
      throw new Error('Database not initialized');
    }

    // Check if patient exists or create new
    let patientId: number;
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
    } else {
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
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Handle load invoices
ipcMain.handle('load-invoices', async () => {
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
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Handle save layout configuration
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

// Handle load layout configuration
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

// Handle file dialog for logo upload
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

// ============ SYNC HANDLERS ============

// Handle manual sync trigger
ipcMain.handle('sync-now', async () => {
  try {
    if (!syncEngine) {
      throw new Error('Sync engine not initialized');
    }

    const result = await syncEngine.performSync();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Get sync status
ipcMain.handle('get-sync-status', async () => {
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
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ============ PATIENT HANDLERS ============

// Create patient
ipcMain.handle('create-patient', async (_event, patientData: any) => {
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
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Get all patients
ipcMain.handle('get-patients', async () => {
  try {
    if (!database) {
      throw new Error('Database not initialized');
    }

    const patients = database.getAllPatients();
    return { success: true, patients };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Get patient by ID
ipcMain.handle('get-patient', async (_event, patientId: number) => {
  try {
    if (!database) {
      throw new Error('Database not initialized');
    }

    const patient = database.getPatient(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    return { success: true, patient };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Search patients by name or UHID
ipcMain.handle('search-patients', async (_event, query: string) => {
  try {
    if (!database) {
      throw new Error('Database not initialized');
    }

    const patients = database.searchPatients(query);
    return { success: true, patients };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Update patient
ipcMain.handle('update-patient', async (_event, patientId: number, patientData: any) => {
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
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
