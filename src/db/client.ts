import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_PATH ?? './data/schedview.db';

type Db = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __schedview_db__: Db | undefined;
}

function createDb(): Db {
  const abs = isAbsolute(DB_PATH) ? DB_PATH : resolve(process.cwd(), DB_PATH);
  mkdirSync(dirname(abs), { recursive: true });
  const sqlite = new Database(abs);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

export const db: Db = globalThis.__schedview_db__ ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__schedview_db__ = db;
}
