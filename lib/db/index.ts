import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;

function initDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // Skip database initialization during build if URL is not available
  if (!process.env.TURSO_CONNECTION_URL) {
    if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
      throw new Error("TURSO_CONNECTION_URL environment variable is required");
    }
    // Return null database for build-time operations
    return dbInstance as any;
  }

  const client = createClient({
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export const db = initDb();

export type Database = typeof db;
