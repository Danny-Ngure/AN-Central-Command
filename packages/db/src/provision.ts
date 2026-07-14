// Fresh-database provisioning.
//
// The committed migration files in ./migrations have drifted from the live schema
// (columns like people.hidden were applied locally via `drizzle-kit push` and never
// captured as migration files), so `drizzle-kit migrate` cannot build a complete
// database from scratch. This script instead applies the full baseline schema in
// ./provision/schema.sql — regenerated from src/schema via `drizzle-kit generate`,
// so it always matches what the app and seed expect.
//
// Run once against an EMPTY database (drop/recreate the public schema first), then:
//   pnpm --filter @an/db db:apply-extras   # RLS, triggers, app_user, encryption
//   pnpm --filter @an/db db:seed
//   NODE_ENV=development pnpm --filter @an/auth seed:credentials
//
// schema.sql uses CREATE TABLE IF NOT EXISTS, so it will NOT backfill columns onto
// pre-existing tables — that is why it must run against an empty schema.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '../provision/schema.sql');

const sql = postgres(url, { max: 1, onnotice: () => {} });

async function main() {
  // Extensions the schema depends on (geometry columns, pgcrypto for column encryption).
  await sql.unsafe('CREATE EXTENSION IF NOT EXISTS postgis');
  await sql.unsafe('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  const ddl = readFileSync(schemaPath, 'utf8');
  // .simple() → simple query protocol, so the multi-statement DDL file runs as one batch.
  await sql.unsafe(ddl).simple();

  console.log('Provisioned baseline schema (extensions + all tables).');
}

main()
  .then(() => sql.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Provision failed:', err.message);
    process.exit(1);
  });
