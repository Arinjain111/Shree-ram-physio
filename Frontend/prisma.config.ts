// Prisma config for Electron SQLite database
// Database path is set dynamically in electron/main.ts based on app.getPath('userData')
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Will be overridden in runtime by Electron
    url: process.env.DATABASE_URL || "file:./dev.db",
  },
});
