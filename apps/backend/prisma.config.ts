import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

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

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
    adapter: new PrismaPg(pool),
  },
});
