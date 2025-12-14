/*
  Warnings:

  - You are about to drop the column `name` on the `patients` table. All the data in the column will be lost.
  - Added the required column `first_name` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `patients` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_patients" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "uhid" TEXT NOT NULL,
    "cloud_id" INTEGER,
    "sync_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "last_sync_at" DATETIME
);
INSERT INTO "new_patients" ("age", "cloud_id", "created_at", "gender", "id", "last_sync_at", "phone", "sync_status", "uhid", "updated_at") SELECT "age", "cloud_id", "created_at", "gender", "id", "last_sync_at", "phone", "sync_status", "uhid", "updated_at" FROM "patients";
DROP TABLE "patients";
ALTER TABLE "new_patients" RENAME TO "patients";
CREATE UNIQUE INDEX "patients_uhid_key" ON "patients"("uhid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
