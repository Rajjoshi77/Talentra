import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

const isLocal =
  databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    adapter: new PrismaPg(pool),
  },
});
