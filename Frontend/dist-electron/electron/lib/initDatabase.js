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
exports.initializeDatabase = initializeDatabase;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const nativeLoader_1 = require("./nativeLoader");
/**
 * Initialize SQLite database with all tables
 * This is required because Prisma 7 with driver adapters cannot run migrations at runtime
 */
async function initializeDatabase() {
    // Dynamically load better-sqlite3 (native module)
    const Database = (0, nativeLoader_1.loadBetterSqlite3)();
    const dbPath = path.join(electron_1.app.getPath('userData'), 'shri-ram-physio.db');
    console.log(`📁 Database path: ${dbPath}`);
    // Check if database already exists and has tables
    if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath);
        try {
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patients'").get();
            if (tables) {
                console.log('✅ Database already initialized');
                db.close();
                return;
            }
        }
        catch (error) {
            console.log('⚠️ Database exists but may be corrupted, recreating...');
        }
        db.close();
    }
    // Create new database with all tables
    console.log('🔨 Creating database tables...');
    const db = new Database(dbPath);
    try {
        // Enable foreign keys
        db.exec('PRAGMA foreign_keys = ON;');
        // Create patients table
        db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        phone TEXT NOT NULL,
        uhid TEXT NOT NULL UNIQUE,
        cloud_id INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_sync_at TEXT
      );
    `);
        // Create invoices table
        db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        patient_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        diagnosis TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        payment_method TEXT NOT NULL DEFAULT 'Cash',
        total REAL NOT NULL,
        cloud_id INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_sync_at TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );
    `);
        db.exec('CREATE INDEX IF NOT EXISTS invoices_patient_id_idx ON invoices(patient_id);');
        // Create treatments table
        db.exec(`
      CREATE TABLE IF NOT EXISTS treatments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        duration TEXT NOT NULL DEFAULT '',
        sessions INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        amount REAL NOT NULL,
        cloud_id INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_sync_at TEXT,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `);
        db.exec('CREATE INDEX IF NOT EXISTS treatments_invoice_id_idx ON treatments(invoice_id);');
        // Create treatment_presets table
        db.exec(`
      CREATE TABLE IF NOT EXISTS treatment_presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        default_sessions INTEGER NOT NULL,
        price_per_session REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create sync_logs table
        db.exec(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT
      );
    `);
        db.exec('CREATE INDEX IF NOT EXISTS sync_logs_table_name_record_id_idx ON sync_logs(table_name, record_id);');
        console.log('✅ Database tables created successfully');
    }
    catch (error) {
        console.error('❌ Failed to create database tables:', error);
        throw error;
    }
    finally {
        db.close();
    }
}
