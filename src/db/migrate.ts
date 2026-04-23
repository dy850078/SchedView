import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const DB_PATH = process.env.DATABASE_PATH ?? './data/schedview.db';
const abs = isAbsolute(DB_PATH) ? DB_PATH : resolve(process.cwd(), DB_PATH);

mkdirSync(dirname(abs), { recursive: true });

const sqlite = new Database(abs);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: './src/db/migrations' });

console.log(`✓ Migrations applied to ${abs}`);
sqlite.close();
