import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing required env var DATABASE_URL. Prisma cannot start without it.",
  );
}

// Use SSL for any non-local/non-internal database (required for Supabase, Render Postgres, Neon, etc.)
// Disable SSL for local connections, Render internal (dpg-xxxx), internal hosts, or explicit sslmode=disable
const isLocalOrInternal =
  databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1") ||
  databaseUrl.includes("dpg-") ||
  databaseUrl.includes("internal");

const hasSslDisable =
  databaseUrl.includes("sslmode=disable") ||
  databaseUrl.includes("ssl=false");

const useSsl = !isLocalOrInternal && !hasSslDisable;

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});
