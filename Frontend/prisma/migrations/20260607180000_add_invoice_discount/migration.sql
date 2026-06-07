-- AlterTable
-- Add `discount` and `discount_type` columns to `invoices` for optional invoice-level discount.
-- Existing rows backfill to 0 / 'amount' so historical invoices render unchanged.

ALTER TABLE "invoices" ADD COLUMN "discount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "discount_type" TEXT NOT NULL DEFAULT 'amount';
