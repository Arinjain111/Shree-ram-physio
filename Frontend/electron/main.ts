import { app, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { setupAutoUpdates } from './services/autoUpdate';
import { getPrismaClient, disconnectPrisma } from './database/prisma';
import { initializeDatabase } from './database/initDatabase';
import { PrismaSyncEngine } from './sync/prismaSyncEngine';
import { registerIpcHandlers } from './ipc/index';
import { logError, logSuccess } from './utils/errorLogger';
import { getBackendUrl } from './config/backend';

// Vite plugin provides these globals - declare them for TS
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Early diagnostics
console.log('[Main] starting process', { pid: process.pid, argv: process.argv, cwd: process.cwd() });

// Suppress Node.js warnings
process.removeAllListeners('warning');

// Disable GPU acceleration to avoid driver issues (especially on some AMD GPUs)
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');

// Global error handlers to avoid silent exits in dev
process.on('uncaughtException', (err) => {
  console.error('[Main] uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] unhandledRejection', reason);
});

dotenv.config();

// Global references
let mainWindow: BrowserWindow | null = null;
let syncEngine: PrismaSyncEngine | null = null;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const shouldOpenDevTools = isDev && process.env.ELECTRON_OPEN_DEVTOOLS !== '0';

function createWindow() {
  console.log('[Main] Creating main window. isDev=', isDev);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Allow ES modules from file:// protocol
    },
  });

  // Suppress unnecessary DevTools warnings
  mainWindow.webContents.on('console-message', (event, ...args: any[]) => {
    // Handle both old and new Electron versions
    const message = typeof args[0] === 'object' ? args[0].message : args[1];

    if (typeof message === 'string' && (message.includes('Autofill') || message.includes("wasn't found"))) {
      event.preventDefault();
    }
  });

  // In Forge, these globals are injected. In Electron Builder they may be undefined.
  const devServerUrl = (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined')
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL
    : process.env.VITE_DEV_SERVER_URL;

  let viteName = (typeof MAIN_WINDOW_VITE_NAME !== 'undefined')
    ? MAIN_WINDOW_VITE_NAME
    : 'main_window';

  // Fix for undefined viteName in packaged app
  if (!viteName || viteName === 'undefined') {
    console.log('[Main] viteName was undefined, enforcing "main_window"');
    viteName = 'main_window';
  }

  if (devServerUrl) {
    // Development mode - load from Vite dev server
    console.log('[Main] Loading dev URL:', devServerUrl);
    mainWindow.loadURL(devServerUrl);
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    // Production mode - load from built files
    // Electron Builder/Vite build outputs to `dist/index.html`
    const candidates = [
      path.join(__dirname, `../renderer/${viteName}/index.html`), // legacy Forge layout
      path.join(__dirname, '../dist/index.html'),                 // current Vite layout
    ];

    const fs = require('fs');
    const indexPath = candidates.find((p: string) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    console.log('[Main] Production index candidates:', candidates);
    console.log('[Main] Loading production index.html from:', indexPath);

    if (!indexPath) {
      throw new Error(`Cannot find renderer index.html. Tried:\n${candidates.join('\n')}`);
    }

    mainWindow.loadFile(indexPath);
    // Do not auto-open DevTools in packaged builds
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
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

app.whenReady().then(async () => {
  setupAutoUpdates();

  // Initialize database tables (create if not exists)
  try {
    await initializeDatabase();
  } catch (error: any) {
    logError('Database initialization', error);
    dialog.showErrorBox('Database Error', `Failed to initialize database: ${error.message}\n${error.stack || ''}`);
  }

  // Initialize Prisma Client (do not crash app on failure)
  let prisma = null;
  try {
    prisma = getPrismaClient();
    // Verify foreign keys are enabled
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    logSuccess('Prisma', 'Client initialized');
  } catch (error: any) {
    prisma = null;
    logError('Prisma initialization', error);
    dialog.showErrorBox('Database Error', `Failed to initialize Prisma: ${error.message}\n${error.stack || ''}`);
  }

  // Initialize sync engine
  const backendUrl = getBackendUrl();
  syncEngine = new PrismaSyncEngine(backendUrl);

  // Start auto-sync (every 5 minutes)
  syncEngine.startAutoSync();

  // Register IPC handlers
  registerIpcHandlers(syncEngine);

  createWindow();
});

app.on('before-quit', async (event) => {
  // Prevent default quit to do cleanup first
  // We check for syncEngine existence, but also just cleanup regardless to be safe
  if (syncEngine || getPrismaClient()) {
    event.preventDefault();

    // Stop sync engine
    if (syncEngine) {
      syncEngine.stopAutoSync();
      syncEngine = null;
    }

    // Disconnect Prisma
    await disconnectPrisma();

    // Force quit after cleanup
    setImmediate(() => app.exit(0));
  }
});

app.on('window-all-closed', () => {
  // On macOS, apps stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
