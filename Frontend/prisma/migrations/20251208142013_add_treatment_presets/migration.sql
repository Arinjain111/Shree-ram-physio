-- CreateTable
CREATE TABLE "treatment_presets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "default_sessions" INTEGER NOT NULL,
    "price_per_session" REAL NOT NULL,
    "default_duration" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
