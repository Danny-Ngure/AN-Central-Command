import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import postgres from 'postgres';

// Apply hand-written SQL "extras" (triggers, RLS policies, column encryption,
// custom functions) that drizzle-kit's auto-generator doesn't produce.
//
// Each file in extras/*.sql is applied once, in lexical order, inside a transaction.
// A small _extras_applied tracking table records which files have been applied so
// re-runs are safe and incremental.
//
// All SQL in extras/ must be IDEMPOTENT (CREATE OR REPLACE / DROP IF EXISTS /
// CREATE INDEX IF NOT EXISTS) so a forced re-run doesn't break things.

config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required. Copy .env.example to .env.local.');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const extrasDir = resolve(__dirname, '../extras');

const sql = postgres(url, { max: 1, onnotice: () => {} });

async function main() {
  // Make the pgcrypto key available to any extras that need it.
  // No throw if missing — extras/04 has its own smoke test using a temp key, and
  // earlier extras don't reference encryption.
  if (process.env.PGCRYPTO_KEY) {
    await sql.unsafe(
      `SET app.encryption_key = '${process.env.PGCRYPTO_KEY.replace(/'/g, "''")}'`,
    );
  }

  await sql`
    CREATE TABLE IF NOT EXISTS _extras_applied (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = readdirSync(extrasDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('(no extras/*.sql files found)');
    return;
  }

  const applied = await sql<{ filename: string }[]>`SELECT filename FROM _extras_applied`;
  const appliedSet = new Set(applied.map((row) => row.filename));

  let appliedCount = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip   ${file}`);
      continue;
    }

    const sqlText = readFileSync(resolve(extrasDir, file), 'utf-8');
    console.log(`  apply  ${file}`);

    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText);
      await tx`INSERT INTO _extras_applied (filename) VALUES (${file})`;
    });
    appliedCount += 1;
  }

  console.log(`\n  ${appliedCount} new extra(s) applied. Total tracked: ${applied.length + appliedCount}.`);
}

main()
  .then(() => sql.end())
  .catch((err) => {
    console.error('\nFailed to apply extras:', err);
    sql.end();
    process.exit(1);
  });
