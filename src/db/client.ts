import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Example: postgres://user:pass@localhost:5432/schedview',
  );
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __schedview_pool__: Pool | undefined;
  var __schedview_db__: Db | undefined;
}

const pool =
  globalThis.__schedview_pool__ ?? new Pool({ connectionString: DATABASE_URL });

export const db: Db =
  globalThis.__schedview_db__ ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__schedview_pool__ = pool;
  globalThis.__schedview_db__ = db;
}
