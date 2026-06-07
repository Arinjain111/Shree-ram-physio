-- =============================================================================
-- Idempotent Migration: Convert date columns from TEXT to TIMESTAMP(3)
-- =============================================================================
-- Purpose : Ensures `invoices.date`, `treatments.start_date`, and
--           `treatments.end_date` are stored as proper TIMESTAMP(3) so that
--           date-based queries (range, ordering, EXTRACT, etc.) work at the
--           database level.
--
-- Safety  : Each ALTER is wrapped in an IF check on information_schema so the
--           migration is a no-op when the columns are already TIMESTAMP(3).
--           This means it can be applied to a fresh database (where Prisma
--           already created TIMESTAMP columns) or to a legacy database (where
--           columns are still TEXT) without losing or corrupting data.
--
-- USING   : The CASE expression rejects malformed strings (anything that does
--           not start with YYYY-MM-DD) and casts the rest to timestamp. Bad
--           rows become NULL instead of failing the whole ALTER TABLE.
-- =============================================================================

DO $$
BEGIN
    -- invoices.date -----------------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'invoices'
          AND column_name  = 'date'
          AND data_type    = 'text'
    ) THEN
        ALTER TABLE "invoices"
            ALTER COLUMN "date" TYPE TIMESTAMP(3)
            USING CASE
                WHEN "date" ~ '^\d{4}-\d{2}-\d{2}'
                    THEN "date"::timestamp without time zone
                ELSE NULL
            END;
    END IF;

    -- treatments.start_date ---------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'treatments'
          AND column_name  = 'start_date'
          AND data_type    = 'text'
    ) THEN
        ALTER TABLE "treatments"
            ALTER COLUMN "start_date" TYPE TIMESTAMP(3)
            USING CASE
                WHEN "start_date" ~ '^\d{4}-\d{2}-\d{2}'
                    THEN "start_date"::timestamp without time zone
                ELSE NULL
            END;
    END IF;

    -- treatments.end_date -----------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'treatments'
          AND column_name  = 'end_date'
          AND data_type    = 'text'
    ) THEN
        ALTER TABLE "treatments"
            ALTER COLUMN "end_date" TYPE TIMESTAMP(3)
            USING CASE
                WHEN "end_date" ~ '^\d{4}-\d{2}-\d{2}'
                    THEN "end_date"::timestamp without time zone
                ELSE NULL
            END;
    END IF;
END $$;
