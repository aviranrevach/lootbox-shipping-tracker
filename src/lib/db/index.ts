import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_PATH || "./data/lootbox.db";

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// One-time migration: rename old DB file to new name
const oldDbPath = path.join(dir, "shipping-tracker.db");
if (!fs.existsSync(DB_PATH) && fs.existsSync(oldDbPath)) {
  fs.renameSync(oldDbPath, DB_PATH);
}

const client = createClient({
  url: `file:${DB_PATH}`,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
