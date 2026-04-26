import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma CLI commands (studio, migrate, db push) need a direct
    // postgresql:// connection. They do NOT support the prisma:// Accelerate
    // protocol. DIRECT_URL is always a raw postgres URL in both environments:
    //   - Local Docker  → postgresql://postgres:password@postgres:5432/...
    //   - Production    → postgresql://...supabase.com:5432/postgres
    // Fall back to DATABASE_URL only when DIRECT_URL is not defined at all.
    url: process.env["DIRECT_URL"] !== undefined
      ? env("DIRECT_URL")
      : env("DATABASE_URL"),
  },
});
