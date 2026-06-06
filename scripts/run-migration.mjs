/**
 * Migration runner — executes 001_initial_schema.sql against Supabase
 * Uses direct PostgreSQL connection via pg
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  connectionString: 'postgresql://postgres:DhpH3dsduTju7Go5@db.ywpsijrcsvfsyczsqjmx.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

const sqlPath = join(__dirname, '../backend/src/database/migrations/001_initial_schema.sql');
const sql = readFileSync(sqlPath, 'utf8');

async function runMigration() {
  console.log('🔌 Connecting to Supabase...');
  await client.connect();
  console.log('✅ Connected');

  console.log('🚀 Running migration 001_initial_schema.sql ...');
  await client.query(sql);
  console.log('✅ Migration complete — all tables created');

  await client.end();
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
