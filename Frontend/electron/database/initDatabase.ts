import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadBetterSqlite3 } from '../lib/nativeLoader';

/**
 * Initialize SQLite database with all tables
 * This is required because Prisma 7 with driver adapters cannot run migrations at runtime
 */
export async function initializeDatabase(): Promise<void> {
    // Dynamically load better-sqlite3 (native module)
    const Database = loadBetterSqlite3();

    const dbPath = path.join(app.getPath('userData'), 'shri-ram-physio.db');
    console.log(`📁 Database path: ${dbPath}`);

    // Check if database already exists and has tables
    if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath);
        try {
            const tables = db.prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='patients'"
            ).get();

            if (tables) {
                // Lightweight migration: make patients.uhid nullable (optional) while preserving data.
                // This is needed because UHID is now optional end-to-end.
                const cols: Array<{ name: string; notnull: number }> = db.prepare('PRAGMA table_info(patients);').all() as any;
                const uhidCol = cols.find(c => c.name === 'uhid');
                const needsUhidNullableMigration = !!uhidCol && uhidCol.notnull === 1;

                if (needsUhidNullableMigration) {
                    console.log('🔧 Migrating local DB: making patients.uhid nullable...');
                    db.exec('PRAGMA foreign_keys = OFF;');
                    db.exec('BEGIN;');
                    try {
                        db.exec(`
                          CREATE TABLE patients_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            first_name TEXT NOT NULL,
                            last_name TEXT NOT NULL,
                            age INTEGER NOT NULL,
                            gender TEXT NOT NULL,
                            phone TEXT NOT NULL,
                            uhid TEXT UNIQUE,
                            cloud_id INTEGER,
                            sync_status TEXT NOT NULL DEFAULT 'PENDING',
                            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            last_sync_at TEXT
                          );
                        `);

                        db.exec(`
                          INSERT INTO patients_new (
                            id, first_name, last_name, age, gender, phone, uhid, cloud_id, sync_status, created_at, updated_at, last_sync_at
                          )
                          SELECT
                            id, first_name, last_name, age, gender, phone, uhid, cloud_id, sync_status, created_at, updated_at, last_sync_at
                          FROM patients;
                        `);

                        db.exec('DROP TABLE patients;');
                        db.exec('ALTER TABLE patients_new RENAME TO patients;');

                        db.exec('COMMIT;');
                        console.log('✅ Local DB migration complete');
                    } catch (e) {
                        db.exec('ROLLBACK;');
                        console.error('❌ Local DB migration failed:', e);
                        throw e;
                    } finally {
                        db.exec('PRAGMA foreign_keys = ON;');
                    }
                }

                console.log('✅ Database already initialized');
                db.close();
                return;
            }
        } catch (error) {
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
        uhid TEXT UNIQUE,
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

    } catch (error) {
        console.error('❌ Failed to create database tables:', error);
        throw error;
    } finally {
        db.close();
    }
}
