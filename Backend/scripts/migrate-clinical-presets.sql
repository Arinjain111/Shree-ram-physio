-- Pre-Deploy Cloud Migration: Migrate diagnosis_presets + exercise_presets → clinical_presets
-- Run this on the production PostgreSQL database BEFORE deploying the new backend.
-- This prevents `prisma db push --accept-data-loss` from dropping the old tables and losing data.
--
-- Usage:
--   DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
--   psql "$DIRECT_URL" -f migrate-clinical-presets.sql
--
-- Steps:
--   1. Create clinical_presets table if not exists
--   2. Migrate data from diagnosis_presets (category = 'diagnosis')
--   3. Migrate data from exercise_presets (category = 'exercise')
--   4. Create index on category
--   5. Add unique constraint on (name, category)
--   6. (Optional) Drop old tables after verifying migration

BEGIN;

-- Step 1: Create clinical_presets table
CREATE TABLE IF NOT EXISTS clinical_presets (
  id            SERIAL PRIMARY KEY,
  name          TEXT    NOT NULL,
  category      TEXT    NOT NULL DEFAULT 'diagnosis',
  frequency     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Migrate diagnosis_presets → clinical_presets
INSERT INTO clinical_presets (name, category, frequency, created_at, updated_at)
SELECT name, 'diagnosis', frequency, created_at, updated_at
FROM diagnosis_presets
ON CONFLICT DO NOTHING;

-- Step 3: Migrate exercise_presets → clinical_presets (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exercise_presets') THEN
    INSERT INTO clinical_presets (name, category, frequency, created_at, updated_at)
    SELECT name, 'exercise', frequency, created_at, updated_at
    FROM exercise_presets
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Step 4: Create index on category
CREATE INDEX IF NOT EXISTS idx_clinical_presets_category ON clinical_presets (category);

-- Step 5: Add unique constraint on (name, category)
ALTER TABLE clinical_presets
  DROP CONSTRAINT IF EXISTS clinical_presets_name_category_key;

ALTER TABLE clinical_presets
  ADD CONSTRAINT clinical_presets_name_category_key UNIQUE (name, category);

-- Summary
DO $$
DECLARE
  diag_count  INTEGER;
  exer_count  INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO diag_count  FROM clinical_presets WHERE category = 'diagnosis';
  SELECT COUNT(*) INTO exer_count  FROM clinical_presets WHERE category = 'exercise';
  SELECT COUNT(*) INTO total_count FROM clinical_presets;

  RAISE NOTICE 'Migration complete: % total presets (% diagnosis, % exercise)',
    total_count, diag_count, exer_count;
END $$;

-- DO NOT drop old tables here — let prisma db push handle that after verifying the migration.
-- If you want to keep old tables as backup, skip the next section entirely.
-- If you want to clean up old tables after verifying, uncomment below:

-- DROP TABLE IF EXISTS diagnosis_presets;
-- DROP TABLE IF EXISTS exercise_presets;

COMMIT;
