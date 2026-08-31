import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV !== "test") {
  throw new Error(
    "Missing required env var DATABASE_URL. Prisma cannot start without it.",
  );
}
const effectiveDatabaseUrl = databaseUrl || "postgresql://dummy:dummy@localhost:5432/dummy";

// Use SSL for any non-local/non-internal database (required for Supabase, Render Postgres, Neon, etc.)
// Disable SSL for local connections, Render internal (dpg-xxxx), internal hosts, or explicit sslmode=disable
const isLocalOrInternal =
  effectiveDatabaseUrl.includes("localhost") ||
  effectiveDatabaseUrl.includes("127.0.0.1") ||
  effectiveDatabaseUrl.includes("dpg-") ||
  effectiveDatabaseUrl.includes("internal");

const hasSslDisable =
  effectiveDatabaseUrl.includes("sslmode=disable") ||
  effectiveDatabaseUrl.includes("ssl=false");

const useSsl = !isLocalOrInternal && !hasSslDisable;

const pool = new pg.Pool({
  connectionString: effectiveDatabaseUrl,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});
