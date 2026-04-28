import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_PATH ?? './data/schedview.db';

type Db = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __schedview_db__: Db | undefined;
  var __schedview_sqlite__: DatabaseSync | undefined;
}

function createDb(): Db {
  const abs = isAbsolute(DB_PATH) ? DB_PATH : resolve(process.cwd(), DB_PATH);
  mkdirSync(dirname(abs), { recursive: true });
  const sqlite = new DatabaseSync(abs);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');
  globalThis.__schedview_sqlite__ = sqlite;

  return drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      if (method === 'run') {
        stmt.run(...(params as never[]));
        return { rows: [] };
      }
      const rows = stmt.all(...(params as never[])) as Record<string, unknown>[];
      return { rows: rows.map((r) => Object.values(r)) };
    },
    { schema },
  );
}

export const db: Db = globalThis.__schedview_db__ ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__schedview_db__ = db;
}
