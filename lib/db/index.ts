import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_CONNECTION_URL environment variable is required");
  }

  const client = createClient({ url, authToken });
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

// Compatibilità retroattiva: esporta db come getter lazy
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as ReturnType<typeof drizzle>)[prop as keyof ReturnType<typeof drizzle>];
  },
});

export type Database = typeof db;
