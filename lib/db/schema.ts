import {
  text,
  integer,
  real,
  sqliteTable,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Draws table (estrazioni lotto)
export const draws = sqliteTable("draws", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  ruota: text("ruota").notNull(), // Nazionale, Roma, Milano, etc.
  n1: integer("n1"),
  n2: integer("n2"),
  n3: integer("n3"),
  n4: integer("n4"),
  n5: integer("n5"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Statistics table (statistiche numeri)
export const stats = sqliteTable("stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruota: text("ruota").notNull(),
  numero: integer("numero").notNull(),
  ritardo: integer("ritardo").notNull().default(0),
  frequenza: integer("frequenza").notNull().default(0),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("stats_ruota_numero_idx").on(table.ruota, table.numero),
]);

// Plays table (giocate dell'utente)
export const plays = sqliteTable("plays", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  numbers: text("numbers").notNull(), // JSON array of numbers
  superstar: integer("superstar"), // numero superstar (optional)
  colonne: integer("colonne").notNull().default(1), // number of columns
  costo: real("costo").notNull(), // total cost
  ruota: text("ruota").default(""), // ruota scelta (es. Bari, Nazionale, ecc.)
  confermata: integer("confermata").default(0), // 0=simulata, 1=reale
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Push subscriptions table
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Push preferences table (per-user notification settings)
export const pushPreferences = sqliteTable("push_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  notifyWins: integer("notify_wins").notNull().default(1),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("push_preferences_user_idx").on(table.userId),
]);

// Push notifications log for idempotency
export const pushNotificationLogs = sqliteTable("push_notification_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  drawId: integer("draw_id").notNull(),
  ruota: text("ruota").notNull(),
  sentAt: text("sent_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("push_notification_logs_user_draw_idx").on(table.userId, table.drawId),
]);
