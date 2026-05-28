import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local for drizzle-kit invocations (it does not auto-load env files).
// Production paths inject DATABASE_URL via the runtime environment.
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env.local before running drizzle-kit.');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // SRS §5.3 — every identifier is UUIDv7 (sortable, offline-safe).
  // SRS NFR-050 — audit_log is append-only, enforced by a trigger we add post-generate.
  verbose: true,
  strict: true,
});
