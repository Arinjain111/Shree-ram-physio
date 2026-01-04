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
const dotenv = __importStar(require("dotenv"));
const autoUpdate_1 = require("./services/autoUpdate");
const prisma_1 = require("./database/prisma");
const initDatabase_1 = require("./database/initDatabase");
const prismaSyncEngine_1 = require("./sync/prismaSyncEngine");
const index_1 = require("./ipc/index");
const errorLogger_1 = require("./utils/errorLogger");
const backend_1 = require("./config/backend");
// Early diagnostics
console.log('[Main] starting process', { pid: process.pid, argv: process.argv, cwd: process.cwd() });
// Handle Squirrel events for Windows installer (MUST BE EARLY)
// Manually handle Squirrel startup events to avoid bundling issues
if (process.platform === 'win32') {
    const squirrelCommand = process.argv[1];
    if (squirrelCommand && squirrelCommand.startsWith('--squirrel')) {
        console.log('[Main] Handling Squirrel event:', squirrelCommand);
        const cp = require('child_process');
        const path = require('path');
        const appFolder = path.resolve(process.execPath, '..');
        const rootFolder = path.resolve(appFolder, '..');
        const updateExe = path.resolve(path.join(rootFolder, 'Update.exe'));
        const exeName = path.basename(process.execPath);
        const spawnUpdate = (args) => {
            try {
                cp.spawn(updateExe, args, { detached: true }).unref();
            }
            catch (error) {
                console.error('[Main] Failed to spawn Update.exe:', error);
            }
        };
        switch (squirrelCommand) {
            case '--squirrel-install':
            case '--squirrel-updated':
                // Create shortcuts on install/update
                spawnUpdate(['--createShortcut', exeName]);
                setTimeout(() => electron_1.app.quit(), 1000);
                break;
            case '--squirrel-uninstall':
                // Remove shortcuts on uninstall
                spawnUpdate(['--removeShortcut', exeName]);
                setTimeout(() => electron_1.app.quit(), 1000);
                break;
            case '--squirrel-obsolete':
                electron_1.app.quit();
                break;
            default:
                break;
        }
    }
}
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
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
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
    (0, autoUpdate_1.setupAutoUpdates)();
    // Initialize database tables (create if not exists)
    try {
        await (0, initDatabase_1.initializeDatabase)();
    }
    catch (error) {
        (0, errorLogger_1.logError)('Database initialization', error);
        electron_1.dialog.showErrorBox('Database Error', `Failed to initialize database: ${error.message}\n${error.stack || ''}`);
    }
    // Initialize Prisma Client (do not crash app on failure)
    let prisma = null;
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
    // Register IPC handlers
    (0, index_1.registerIpcHandlers)(syncEngine);
    createWindow();
});
electron_1.app.on('before-quit', async (event) => {
    // Prevent default quit to do cleanup first
    // We check for syncEngine existence, but also just cleanup regardless to be safe
    if (syncEngine || (0, prisma_1.getPrismaClient)()) {
        event.preventDefault();
        // Stop sync engine
        if (syncEngine) {
            syncEngine.stopAutoSync();
            syncEngine = null;
        }
        // Disconnect Prisma
        await (0, prisma_1.disconnectPrisma)();
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
