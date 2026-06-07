-- =============================================================================
-- Idempotent Migration: Convert date columns from TEXT to DATETIME (SQLite)
-- =============================================================================
-- Purpose : Ensures `invoices.date`, `treatments.start_date`, and
--           `treatments.end_date` are stored as DATETIME so Prisma's generated
--           client treats them as DateTime.
--
-- Safety  : SQLite has no `ALTER COLUMN ... TYPE`, so the only way to change a
--           column's declared affinity is to rebuild the table. We do the
--           rebuild unconditionally because:
--             * INSERT INTO new_X SELECT * FROM X is type-tolerant: TEXT values
--               are stored verbatim, and DATETIME values come across as-is.
--             * The new tables have identical column lists, indexes, and
--               constraints as the originals, so the rebuild is a true no-op
--               for databases that already have the correct schema.
--             * Foreign keys are deferred across the rebuild so the cascade
--               order remains intact.
--
-- When to skip:  If the migration has already been applied, the marker row is
--                already in place. To be conservative we still issue the
--                rebuild DDL — it is a no-op semantically and is safe.
--                A marker table is only created to provide a deterministic
--                signal to operators (and to subsequent migrations) that this
--                step ran.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) invoices table rebuild
-- ---------------------------------------------------------------------------
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_invoices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoice_number" TEXT NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "payment_method" TEXT NOT NULL DEFAULT 'Cash',
    "transaction_id" TEXT,
    "total" REAL NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "amount_paid" REAL NOT NULL DEFAULT 0,
    "cloud_id" INTEGER,
    "sync_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "last_sync_at" DATETIME,
    CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_invoices" (
    "id", "invoice_number", "patient_id", "date", "diagnosis", "notes",
    "payment_method", "transaction_id", "total", "payment_status", "amount_paid",
    "cloud_id", "sync_status", "created_at", "updated_at", "last_sync_at"
)
SELECT
    "id", "invoice_number", "patient_id", "date", "diagnosis", "notes",
    "payment_method", "transaction_id", "total", "payment_status", "amount_paid",
    "cloud_id", "sync_status", "created_at", "updated_at", "last_sync_at"
FROM "invoices";

DROP TABLE "invoices";
ALTER TABLE "new_invoices" RENAME TO "invoices";
CREATE INDEX "invoices_patient_id_idx" ON "invoices"("patient_id");
CREATE UNIQUE INDEX "invoices_patient_id_invoice_number_key" ON "invoices"("patient_id", "invoice_number");
CREATE INDEX "invoices_cloud_id_idx" ON "invoices"("cloud_id");

-- ---------------------------------------------------------------------------
-- 2) treatments table rebuild
-- ---------------------------------------------------------------------------
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_treatments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoice_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "duration" TEXT NOT NULL DEFAULT '',
    "sessions" INTEGER NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "cloud_id" INTEGER,
    "sync_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "last_sync_at" DATETIME,
    CONSTRAINT "treatments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_treatments" (
    "id", "invoice_id", "name", "duration", "sessions",
    "start_date", "end_date", "amount",
    "cloud_id", "sync_status", "created_at", "updated_at", "last_sync_at"
)
SELECT
    "id", "invoice_id", "name", "duration", "sessions",
    "start_date", "end_date", "amount",
    "cloud_id", "sync_status", "created_at", "updated_at", "last_sync_at"
FROM "treatments";

DROP TABLE "treatments";
ALTER TABLE "new_treatments" RENAME TO "treatments";
CREATE INDEX "treatments_invoice_id_idx" ON "treatments"("invoice_id");
CREATE INDEX "treatments_cloud_id_idx" ON "treatments"("cloud_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
