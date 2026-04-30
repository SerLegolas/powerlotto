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
