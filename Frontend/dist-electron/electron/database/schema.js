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
exports.LocalDatabase = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
class LocalDatabase {
    constructor(dbPath) {
        const finalPath = dbPath || path.join(electron_1.app.getPath('userData'), 'clinic_data.db');
        this.db = new better_sqlite3_1.default(finalPath);
        this.initializeTables();
    }
    initializeTables() {
        // Patients table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        phone TEXT NOT NULL,
        uhid TEXT UNIQUE NOT NULL,
        sync_status TEXT DEFAULT 'PENDING',
        cloud_id TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_sync_at TEXT
      );
    `);
        // Invoices table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        diagnosis TEXT,
        notes TEXT,
        payment_method TEXT NOT NULL,
        total REAL NOT NULL,
        sync_status TEXT DEFAULT 'PENDING',
        cloud_id TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_sync_at TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );
    `);
        // Treatments table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS treatments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        duration TEXT,
        sessions INTEGER DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        amount REAL NOT NULL,
        sync_status TEXT DEFAULT 'PENDING',
        cloud_id TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `);
        // Sync logs table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT
      );
    `);
        // Create indexes for performance
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patients_sync ON patients(sync_status);
      CREATE INDEX IF NOT EXISTS idx_invoices_sync ON invoices(sync_status);
      CREATE INDEX IF NOT EXISTS idx_treatments_sync ON treatments(sync_status);
      CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
    `);
    }
    // Patient operations
    createPatient(patient) {
        const stmt = this.db.prepare(`
      INSERT INTO patients (name, age, gender, phone, uhid, sync_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(patient.name, patient.age, patient.gender, patient.phone, patient.uhid, 'PENDING');
        return info.lastInsertRowid;
    }
    getPatient(id) {
        return this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    }
    getPatientByUHID(uhid) {
        return this.db.prepare('SELECT * FROM patients WHERE uhid = ?').get(uhid);
    }
    getAllPatients() {
        return this.db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
    }
    updatePatient(id, patient) {
        const fields = Object.keys(patient).filter(k => k !== 'id');
        const values = fields.map(f => patient[f]);
        const stmt = this.db.prepare(`
      UPDATE patients 
      SET ${fields.map(f => `${f} = ?`).join(', ')}, 
          updated_at = CURRENT_TIMESTAMP,
          sync_status = 'PENDING'
      WHERE id = ?
    `);
        stmt.run(...values, id);
    }
    searchPatients(query) {
        const searchTerm = `%${query}%`;
        return this.db.prepare(`
      SELECT * FROM patients 
      WHERE name LIKE ? OR uhid LIKE ?
      ORDER BY created_at DESC
    `).all(searchTerm, searchTerm);
    }
    // Invoice operations
    createInvoice(invoice) {
        const stmt = this.db.prepare(`
      INSERT INTO invoices (invoice_number, patient_id, date, diagnosis, notes, payment_method, total, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(invoice.invoice_number, invoice.patient_id, invoice.date, invoice.diagnosis || '', '', // notes - default empty
        'Cash', // payment_method - default
        invoice.total, 'PENDING');
        return info.lastInsertRowid;
    }
    getInvoice(id) {
        return this.db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    }
    getAllInvoices() {
        return this.db.prepare('SELECT * FROM invoices ORDER BY date DESC').all();
    }
    // Treatment operations
    createTreatment(treatment) {
        const stmt = this.db.prepare(`
      INSERT INTO treatments (invoice_id, name, duration, sessions, start_date, end_date, amount, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(treatment.invoice_id, treatment.name, '', // duration - default empty
        treatment.sessions, treatment.start_date, treatment.end_date, treatment.amount, 'PENDING');
        return info.lastInsertRowid;
    }
    getTreatment(id) {
        return this.db.prepare('SELECT * FROM treatments WHERE id = ?').get(id);
    }
    getTreatmentsByInvoice(invoiceId) {
        return this.db.prepare('SELECT * FROM treatments WHERE invoice_id = ?').all(invoiceId);
    }
    // Sync operations
    getPendingRecords(table) {
        return this.db.prepare(`SELECT * FROM ${table} WHERE sync_status = 'PENDING'`).all();
    }
    markAsSynced(table, id, cloudId) {
        this.db.prepare(`
      UPDATE ${table}
      SET sync_status = 'SYNCED', cloud_id = ?, last_sync_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cloudId, id);
    }
    updateFromCloud(table, cloudId, data) {
        const fields = Object.keys(data).filter(k => !['id', 'cloud_id'].includes(k));
        const values = fields.map(f => data[f]);
        this.db.prepare(`
      UPDATE ${table}
      SET ${fields.map(f => `${f} = ?`).join(', ')},
          sync_status = 'SYNCED',
          last_sync_at = CURRENT_TIMESTAMP
      WHERE cloud_id = ?
    `).run(...values, cloudId);
    }
    // Sync log operations
    createSyncLog(log) {
        this.db.prepare(`
      INSERT INTO sync_logs (entity_type, entity_id, action, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(log.entity_type, log.entity_id, log.action, log.status, log.error_message || null);
    }
    getLastSyncLog() {
        const log = this.db.prepare(`
      SELECT *, created_at as sync_date, status as sync_status
      FROM sync_logs 
      WHERE status = 'success'
      ORDER BY created_at DESC 
      LIMIT 1
    `).get();
        return log;
    }
    close() {
        this.db.close();
    }
}
exports.LocalDatabase = LocalDatabase;
