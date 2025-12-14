import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

export interface Patient {
  id?: number;
  name: string;
  age: number;
  gender: string;
  phone: string;
  uhid: string;
  // Sync fields
  sync_status: 'SYNCED' | 'PENDING' | 'CONFLICT';
  cloud_id?: string;
  created_at: string;
  updated_at: string;
  last_sync_at?: string;
}

export interface Invoice {
  id?: number;
  invoice_number: string;
  patient_id: number;
  date: string;
  diagnosis: string;
  notes: string;
  payment_method: string;
  total: number;
  // Sync fields
  sync_status: 'SYNCED' | 'PENDING' | 'CONFLICT';
  cloud_id?: string;
  created_at: string;
  updated_at: string;
  last_sync_at?: string;
}

export interface Treatment {
  id?: number;
  invoice_id: number;
  name: string;
  duration: string;
  sessions: number;
  start_date: string;
  end_date: string;
  amount: number;
  // Sync fields
  sync_status: 'SYNCED' | 'PENDING' | 'CONFLICT';
  cloud_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id?: number;
  entity_type: 'patient' | 'invoice' | 'treatment';
  entity_id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  status: 'pending' | 'success' | 'failed';
  error_message?: string;
  created_at: string;
  synced_at?: string;
  sync_date?: string;  // Alias for created_at
  sync_status?: string;  // Alias for status
}

export class LocalDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.join(app.getPath('userData'), 'clinic_data.db');
    this.db = new Database(finalPath);
    this.initializeTables();
  }

  private initializeTables() {
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
  createPatient(patient: Omit<Patient, 'id' | 'created_at' | 'updated_at' | 'sync_status' | 'cloud_id' | 'last_sync_at'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO patients (name, age, gender, phone, uhid, sync_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      patient.name,
      patient.age,
      patient.gender,
      patient.phone,
      patient.uhid,
      'PENDING'
    );

    return info.lastInsertRowid as number;
  }

  getPatient(id: number): Patient | undefined {
    return this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Patient;
  }

  getPatientByUHID(uhid: string): Patient | undefined {
    return this.db.prepare('SELECT * FROM patients WHERE uhid = ?').get(uhid) as Patient;
  }

  getAllPatients(): Patient[] {
    return this.db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all() as Patient[];
  }

  updatePatient(id: number, patient: Partial<Patient>): void {
    const fields = Object.keys(patient).filter(k => k !== 'id');
    const values = fields.map(f => (patient as any)[f]);
    
    const stmt = this.db.prepare(`
      UPDATE patients 
      SET ${fields.map(f => `${f} = ?`).join(', ')}, 
          updated_at = CURRENT_TIMESTAMP,
          sync_status = 'PENDING'
      WHERE id = ?
    `);
    
    stmt.run(...values, id);
  }

  searchPatients(query: string): Patient[] {
    const searchTerm = `%${query}%`;
    return this.db.prepare(`
      SELECT * FROM patients 
      WHERE name LIKE ? OR uhid LIKE ?
      ORDER BY created_at DESC
    `).all(searchTerm, searchTerm) as Patient[];
  }

  // Invoice operations
  createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'sync_status' | 'cloud_id' | 'last_sync_at' | 'notes' | 'payment_method'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO invoices (invoice_number, patient_id, date, diagnosis, notes, payment_method, total, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      invoice.invoice_number,
      invoice.patient_id,
      invoice.date,
      invoice.diagnosis || '',
      '', // notes - default empty
      'Cash', // payment_method - default
      invoice.total,
      'PENDING'
    );

    return info.lastInsertRowid as number;
  }

  getInvoice(id: number): Invoice | undefined {
    return this.db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Invoice;
  }

  getAllInvoices(): Invoice[] {
    return this.db.prepare('SELECT * FROM invoices ORDER BY date DESC').all() as Invoice[];
  }

  // Treatment operations
  createTreatment(treatment: Omit<Treatment, 'id' | 'created_at' | 'updated_at' | 'sync_status' | 'cloud_id' | 'last_sync_at' | 'duration'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO treatments (invoice_id, name, duration, sessions, start_date, end_date, amount, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      treatment.invoice_id,
      treatment.name,
      '', // duration - default empty
      treatment.sessions,
      treatment.start_date,
      treatment.end_date,
      treatment.amount,
      'PENDING'
    );

    return info.lastInsertRowid as number;
  }

  getTreatment(id: number): Treatment | undefined {
    return this.db.prepare('SELECT * FROM treatments WHERE id = ?').get(id) as Treatment;
  }

  getTreatmentsByInvoice(invoiceId: number): Treatment[] {
    return this.db.prepare('SELECT * FROM treatments WHERE invoice_id = ?').all(invoiceId) as Treatment[];
  }

  // Sync operations
  getPendingRecords(table: string): any[] {
    return this.db.prepare(`SELECT * FROM ${table} WHERE sync_status = 'PENDING'`).all();
  }

  markAsSynced(table: string, id: number, cloudId: string): void {
    this.db.prepare(`
      UPDATE ${table}
      SET sync_status = 'SYNCED', cloud_id = ?, last_sync_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cloudId, id);
  }

  updateFromCloud(table: string, cloudId: string, data: any): void {
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
  createSyncLog(log: Omit<SyncLog, 'id' | 'created_at'>): void {
    this.db.prepare(`
      INSERT INTO sync_logs (entity_type, entity_id, action, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(log.entity_type, log.entity_id, log.action, log.status, log.error_message || null);
  }

  getLastSyncLog(): SyncLog | undefined {
    const log = this.db.prepare(`
      SELECT *, created_at as sync_date, status as sync_status
      FROM sync_logs 
      WHERE status = 'success'
      ORDER BY created_at DESC 
      LIMIT 1
    `).get() as SyncLog | undefined;
    return log;
  }

  close() {
    this.db.close();
  }
}
