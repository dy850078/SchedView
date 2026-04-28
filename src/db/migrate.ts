import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Example: postgres://user:pass@localhost:5432/schedview',
  );
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  const safeUrl = DATABASE_URL!.replace(/:[^:@/]*@/, ':***@');
  console.log(`✓ Migrations applied to ${safeUrl}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
