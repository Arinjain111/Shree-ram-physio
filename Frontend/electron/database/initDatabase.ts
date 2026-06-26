import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadBetterSqlite3 } from '../lib/nativeLoader';
import { seedClinicalData } from './seedClinicalPresets';
import { logger } from '../utils/logger';

/**
 * Initialize SQLite database with all tables
 * This is required because Prisma 7 with driver adapters cannot run migrations at runtime
 */
export async function initializeDatabase(): Promise<void> {
    // Dynamically load better-sqlite3 (native module)
    const Database = loadBetterSqlite3();

    const dbPath = path.join(app.getPath('userData'), 'shri-ram-physio.db');
    logger.info('db', 'Database path', { path: dbPath });

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
                    logger.info('db', 'Migrating local DB: making patients.uhid nullable');
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
                        logger.info('db', 'Local DB migration complete');
                    } catch (e) {
                        db.exec('ROLLBACK;');
                        logger.error('db', 'Local DB migration failed', { error: e instanceof Error ? e.message : String(e) });
                        throw e;
                    } finally {
                        db.exec('PRAGMA foreign_keys = ON;');
                    }
                }

                // Lightweight migration: add transaction_id column to invoices if missing.
                const invoiceCols: Array<{ name: string }> = db.prepare('PRAGMA table_info(invoices);').all() as any;
                const hasTransactionId = invoiceCols.some(c => c.name === 'transaction_id');

                if (!hasTransactionId) {
                    logger.info('db', 'Migrating local DB: adding transaction_id to invoices');
                    try {
                        db.exec('ALTER TABLE invoices ADD COLUMN transaction_id TEXT;');
                        logger.info('db', 'transaction_id column added');
                    } catch (e) {
                        logger.error('db', 'Failed to add transaction_id column', { error: e instanceof Error ? e.message : String(e) });
                    }
                }

                // Lightweight migration: add payment_status and amount_paid to invoices if missing.
                const hasPaymentStatus = invoiceCols.some(c => c.name === 'payment_status');
                if (!hasPaymentStatus) {
                    logger.info('db', 'Migrating local DB: adding payment_status to invoices');
                    try {
                        db.exec("ALTER TABLE invoices ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';");
                        logger.info('db', 'payment_status column added');
                    } catch (e) {
                        logger.error('db', 'Failed to add payment_status column', { error: e instanceof Error ? e.message : String(e) });
                    }
                }
                const hasAmountPaid = invoiceCols.some(c => c.name === 'amount_paid');
                if (!hasAmountPaid) {
                    logger.info('db', 'Migrating local DB: adding amount_paid to invoices');
                    try {
                        db.exec('ALTER TABLE invoices ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0;');
                        logger.info('db', 'amount_paid column added');
                    } catch (e) {
                        logger.error('db', 'Failed to add amount_paid column', { error: e instanceof Error ? e.message : String(e) });
                    }
                }

                // Lightweight migration: add discount and discount_type to invoices if missing.
                const hasDiscount = invoiceCols.some(c => c.name === 'discount');
                if (!hasDiscount) {
                    logger.info('db', 'Migrating local DB: adding discount to invoices');
                    try {
                        db.exec('ALTER TABLE invoices ADD COLUMN discount REAL NOT NULL DEFAULT 0;');
                        logger.info('db', 'discount column added');
                    } catch (e) {
                        logger.error('db', 'Failed to add discount column', { error: e instanceof Error ? e.message : String(e) });
                    }
                }
                const hasDiscountType = invoiceCols.some(c => c.name === 'discount_type');
                if (!hasDiscountType) {
                    logger.info('db', 'Migrating local DB: adding discount_type to invoices');
                    try {
                        db.exec("ALTER TABLE invoices ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'amount';");
                        logger.info('db', 'discount_type column added');
                    } catch (e) {
                        logger.error('db', 'Failed to add discount_type column', { error: e instanceof Error ? e.message : String(e) });
                    }
                }

                // Lightweight migration: add clinical_presets table if missing.
                const existingTables: Array<{ name: string }> = db.prepare(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).all() as any;
                const hasClinicalPresets = existingTables.some(t => t.name === 'clinical_presets');
                if (!hasClinicalPresets) {
                    logger.info('db', 'Migrating local DB: adding clinical_presets table');
                    db.exec(`
                CREATE TABLE IF NOT EXISTS clinical_presets (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  category TEXT NOT NULL,
                  frequency INTEGER NOT NULL DEFAULT 0,
                  cloud_id INTEGER,
                  sync_status TEXT NOT NULL DEFAULT 'PENDING',
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  last_sync_at TEXT,
                  UNIQUE(name, category)
                );
                CREATE INDEX IF NOT EXISTS clinical_presets_category_idx ON clinical_presets(category);
              `);
                    logger.info('db', 'clinical_presets table added');

                    // Migrate data from old diagnosis_presets and exercise_presets tables
                    const hasOldDiagnosisPresets = existingTables.some(t => t.name === 'diagnosis_presets');
                    if (hasOldDiagnosisPresets) {
                        try {
                            db.exec(`
                                INSERT OR IGNORE INTO clinical_presets (name, category, frequency, cloud_id, sync_status, created_at, updated_at, last_sync_at)
                                SELECT name, 'diagnosis', frequency, cloud_id, sync_status, created_at, updated_at, last_sync_at
                                FROM diagnosis_presets;
                            `);
                            logger.info('db', 'Migrated data from diagnosis_presets to clinical_presets');
                        } catch (e) {
                            logger.error('db', 'Failed to migrate diagnosis_presets data', { error: e instanceof Error ? e.message : String(e) });
                        }
                    }
                    const hasOldExercisePresets = existingTables.some(t => t.name === 'exercise_presets');
                    if (hasOldExercisePresets) {
                        try {
                            db.exec(`
                                INSERT OR IGNORE INTO clinical_presets (name, category, frequency, cloud_id, sync_status, created_at, updated_at, last_sync_at)
                                SELECT name, 'exercise', frequency, cloud_id, sync_status, created_at, updated_at, last_sync_at
                                FROM exercise_presets;
                            `);
                            logger.info('db', 'Migrated data from exercise_presets to clinical_presets');
                        } catch (e) {
                            logger.error('db', 'Failed to migrate exercise_presets data', { error: e instanceof Error ? e.message : String(e) });
                        }
                    }
                }
                const hasDiagnosisShortcuts = existingTables.some(t => t.name === 'diagnosis_shortcuts');
                if (!hasDiagnosisShortcuts) {
                    logger.info('db', 'Migrating local DB: adding diagnosis_shortcuts table');
                    db.exec(`
                CREATE TABLE IF NOT EXISTS diagnosis_shortcuts (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  shortcut TEXT NOT NULL UNIQUE,
                  expands TEXT NOT NULL
                );
              `);
                    logger.info('db', 'diagnosis_shortcuts table added');
                }

                const hasInventoryItems = existingTables.some(t => t.name === 'inventory_items');
                if (!hasInventoryItems) {
                    logger.info('db', 'Migrating local DB: adding inventory_items table');
                    db.exec(`
                      CREATE TABLE IF NOT EXISTS inventory_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        description TEXT,
                        stock INTEGER NOT NULL DEFAULT 0,
                        cost_price REAL NOT NULL DEFAULT 0,
                        selling_price REAL NOT NULL DEFAULT 0,
                        cloud_id INTEGER,
                        sync_status TEXT NOT NULL DEFAULT 'PENDING',
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        last_sync_at TEXT
                      );
                    `);
                    logger.info('db', 'inventory_items table added');
                }

                const hasInventoryTransactions = existingTables.some(t => t.name === 'inventory_transactions');
                if (!hasInventoryTransactions) {
                    logger.info('db', 'Migrating local DB: adding inventory_transactions table');
                    db.exec(`
                      CREATE TABLE IF NOT EXISTS inventory_transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        item_id INTEGER NOT NULL,
                        type TEXT NOT NULL,
                        quantity INTEGER NOT NULL,
                        price_per_unit REAL NOT NULL,
                        total_amount REAL NOT NULL,
                        date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        notes TEXT,
                        cloud_id INTEGER,
                        sync_status TEXT NOT NULL DEFAULT 'PENDING',
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        last_sync_at TEXT,
                        FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
                      );
                      CREATE INDEX IF NOT EXISTS inventory_transactions_item_id_idx ON inventory_transactions(item_id);
                    `);
                    logger.info('db', 'inventory_transactions table added');
                }

                const hasSessionNoteTemplates = existingTables.some(t => t.name === 'session_note_templates');
                if (!hasSessionNoteTemplates) {
                    logger.info('db', 'Migrating local DB: adding session_note_templates table');
                    db.exec(`
                      CREATE TABLE IF NOT EXISTS session_note_templates (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        text TEXT NOT NULL UNIQUE,
                        "order" INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                      );
                    `);
                    logger.info('db', 'session_note_templates table added');
                }

                const hasTreatmentSessions = existingTables.some(t => t.name === 'treatment_sessions');
                if (!hasTreatmentSessions) {
                    logger.info('db', 'Migrating local DB: adding treatment_sessions table');
                    db.exec(`
                      CREATE TABLE IF NOT EXISTS treatment_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        treatment_id INTEGER NOT NULL,
                        session_number INTEGER NOT NULL,
                        date TEXT,
                        attended INTEGER NOT NULL DEFAULT 0,
                        pain_before INTEGER,
                        pain_after INTEGER,
                        notes TEXT NOT NULL DEFAULT '',
                        exercises_performed TEXT NOT NULL DEFAULT '',
                        progress TEXT,
                        cancelled INTEGER NOT NULL DEFAULT 0,
                        rescheduled_date TEXT,
                        cloud_id INTEGER,
                        sync_status TEXT NOT NULL DEFAULT 'PENDING',
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        last_sync_at TEXT,
                        FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE
                      );
                      CREATE INDEX IF NOT EXISTS treatment_sessions_treatment_id_idx ON treatment_sessions(treatment_id);
                      CREATE INDEX IF NOT EXISTS treatment_sessions_sync_status_idx ON treatment_sessions(sync_status);
                    `);
                    logger.info('db', 'treatment_sessions table added');
                }

                const hasExpenses = existingTables.some(t => t.name === 'expenses');
                if (!hasExpenses) {
                    logger.info('db', 'Migrating local DB: adding expenses table');
                    db.exec(`
                      CREATE TABLE IF NOT EXISTS expenses (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category TEXT NOT NULL,
                        amount REAL NOT NULL,
                        date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        notes TEXT,
                        cloud_id INTEGER,
                        sync_status TEXT NOT NULL DEFAULT 'PENDING',
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        last_sync_at TEXT
                      );
                    `);
                    logger.info('db', 'expenses table added');
                }

                logger.info('db', 'Database already initialized');
                db.close();

                seedClinicalData();
                return;
            }
        } catch (error) {
            logger.warn('db', 'Database exists but may be corrupted, recreating', { error: error instanceof Error ? error.message : String(error) });
        }
        db.close();
    }

    // Create new database with all tables
    logger.info('db', 'Creating database tables');
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
        transaction_id TEXT,
        total REAL NOT NULL,
        discount REAL NOT NULL DEFAULT 0,
        discount_type TEXT NOT NULL DEFAULT 'amount',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        amount_paid REAL NOT NULL DEFAULT 0,
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

        // Create clinical_presets table (unified for diagnoses + exercises)
        db.exec(`
      CREATE TABLE IF NOT EXISTS clinical_presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        frequency INTEGER NOT NULL DEFAULT 0,
        cloud_id INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_sync_at TEXT,
        UNIQUE(name, category)
      );
    `);

        // Create diagnosis_shortcuts table
        db.exec(`
      CREATE TABLE IF NOT EXISTS diagnosis_shortcuts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shortcut TEXT NOT NULL UNIQUE,
        expands TEXT NOT NULL
      );
    `);

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

        db.exec('CREATE INDEX IF NOT EXISTS clinical_presets_category_idx ON clinical_presets(category);');

        // Create inventory_items table
        db.exec(`
          CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            stock INTEGER NOT NULL DEFAULT 0,
            cost_price REAL NOT NULL DEFAULT 0,
            selling_price REAL NOT NULL DEFAULT 0,
            cloud_id INTEGER,
            sync_status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_sync_at TEXT
          );
        `);

        // Create inventory_transactions table
        db.exec(`
          CREATE TABLE IF NOT EXISTS inventory_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price_per_unit REAL NOT NULL,
            total_amount REAL NOT NULL,
            date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            cloud_id INTEGER,
            sync_status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_sync_at TEXT,
            FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
          );
        `);
        db.exec('CREATE INDEX IF NOT EXISTS inventory_transactions_item_id_idx ON inventory_transactions(item_id);');

        // Create session_note_templates table
        db.exec(`
          CREATE TABLE IF NOT EXISTS session_note_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL UNIQUE,
            "order" INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create treatment_sessions table
        db.exec(`
          CREATE TABLE IF NOT EXISTS treatment_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            treatment_id INTEGER NOT NULL,
            session_number INTEGER NOT NULL,
            date TEXT,
            attended INTEGER NOT NULL DEFAULT 0,
            pain_before INTEGER,
            pain_after INTEGER,
            notes TEXT NOT NULL DEFAULT '',
            exercises_performed TEXT NOT NULL DEFAULT '',
            progress TEXT,
            cancelled INTEGER NOT NULL DEFAULT 0,
            rescheduled_date TEXT,
            cloud_id INTEGER,
            sync_status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_sync_at TEXT,
            FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE
          );
        `);
        db.exec('CREATE INDEX IF NOT EXISTS treatment_sessions_treatment_id_idx ON treatment_sessions(treatment_id);');
        db.exec('CREATE INDEX IF NOT EXISTS treatment_sessions_sync_status_idx ON treatment_sessions(sync_status);');

        // Create expenses table
        db.exec(`
          CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            cloud_id INTEGER,
            sync_status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_sync_at TEXT
          );
        `);

        logger.info('db', 'Database tables created successfully');

        seedClinicalData();

    } catch (error) {
        logger.error('db', 'Failed to create database tables', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    } finally {
        db.close();
    }
}
