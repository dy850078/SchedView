import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const DB_PATH = process.env.DATABASE_PATH ?? './data/schedview.db';
const abs = isAbsolute(DB_PATH) ? DB_PATH : resolve(process.cwd(), DB_PATH);

mkdirSync(dirname(abs), { recursive: true });

const sqlite = new DatabaseSync(abs);
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

const db = drizzle(async (sql, params, method) => {
  const stmt = sqlite.prepare(sql);
  if (method === 'run') {
    stmt.run(...(params as never[]));
    return { rows: [] };
  }
  const rows = stmt.all(...(params as never[])) as Record<string, unknown>[];
  return { rows: rows.map((r) => Object.values(r)) };
});

async function main() {
  await migrate(
    db,
    async (queries: string[]) => {
      for (const q of queries) sqlite.exec(q);
    },
    { migrationsFolder: './src/db/migrations' },
  );
  console.log(`✓ Migrations applied to ${abs}`);
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
