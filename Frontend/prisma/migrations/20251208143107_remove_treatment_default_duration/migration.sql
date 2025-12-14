/*
  Warnings:

  - You are about to drop the column `default_duration` on the `treatment_presets` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_treatment_presets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "default_sessions" INTEGER NOT NULL,
    "price_per_session" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_treatment_presets" ("created_at", "default_sessions", "id", "name", "price_per_session", "updated_at") SELECT "created_at", "default_sessions", "id", "name", "price_per_session", "updated_at" FROM "treatment_presets";
DROP TABLE "treatment_presets";
ALTER TABLE "new_treatment_presets" RENAME TO "treatment_presets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
