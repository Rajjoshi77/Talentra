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

const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});
