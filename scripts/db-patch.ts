import dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@libsql/client";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function run() {
  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_CONNECTION_URL or TURSO_AUTH_TOKEN");
  }

  const db = createClient({ url, authToken });

  const usersInfo = await db.execute({ sql: "PRAGMA table_info(users)" });
  const userColumns = (usersInfo.rows ?? []).map((row: any) => row.name);
  if (!userColumns.includes("role")) {
    await db.execute({ sql: "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'" });
    console.log("Added role column to users table.");
  } else {
    console.log("Users table already has role column.");
  }

  const indexInfo = await db.execute({ sql: "SELECT name FROM sqlite_master WHERE type='index' AND name='push_notification_logs_user_draw_idx'" });
  if ((indexInfo.rows ?? []).length === 0) {
    await db.execute({ sql: "CREATE UNIQUE INDEX push_notification_logs_user_draw_idx ON push_notification_logs (user_id, draw_id)" });
    console.log("Created missing push_notification_logs_user_draw_idx index.");
  } else {
    console.log("Index push_notification_logs_user_draw_idx already exists.");
  }

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS push_notification_settings (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL DEFAULT 'scheduled',
    title_template TEXT NOT NULL DEFAULT 'PowerLotto Notification',
    body_template TEXT NOT NULL DEFAULT 'Hai un nuovo aggiornamento PowerLotto.',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )` });
  console.log("Ensured push_notification_settings table exists.");

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS push_notification_schedules (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    cron_expression TEXT NOT NULL DEFAULT '0 * * * *',
    time TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    target_type TEXT NOT NULL DEFAULT 'all',
    target_user_ids TEXT NOT NULL DEFAULT '[]',
    title_template TEXT NOT NULL DEFAULT 'PowerLotto Notification',
    body_template TEXT NOT NULL DEFAULT 'Hai un nuovo aggiornamento PowerLotto.',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )` });
  console.log("Ensured push_notification_schedules table exists.");

  const schedulesInfo = await db.execute({ sql: "PRAGMA table_info(push_notification_schedules)" });
  const scheduleColumns = (schedulesInfo.rows ?? []).map((row: any) => row.name);
  if (!scheduleColumns.includes("title_template")) {
    await db.execute({ sql: "ALTER TABLE push_notification_schedules ADD COLUMN title_template TEXT NOT NULL DEFAULT 'PowerLotto Notification'" });
    console.log("Added title_template column to push_notification_schedules table.");
  } else {
    console.log("push_notification_schedules already has title_template column.");
  }
  if (!scheduleColumns.includes("body_template")) {
    await db.execute({ sql: "ALTER TABLE push_notification_schedules ADD COLUMN body_template TEXT NOT NULL DEFAULT 'Hai un nuovo aggiornamento PowerLotto.'" });
    console.log("Added body_template column to push_notification_schedules table.");
  } else {
    console.log("push_notification_schedules already has body_template column.");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
