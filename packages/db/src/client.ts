import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

// Database client factory.
//
// The application passes the authenticated user's role + ward_id in connection-local
// session variables on every transaction (SRS FR-002). RLS policies then read those
// variables via current_setting() to decide which rows the query may see.
//
// This factory does not set session variables — the caller (route handler, worker)
// does that per-transaction via setRequestContext() before executing queries.

// Lazy singleton. The connection (and the DATABASE_URL check) is deferred to the
// first actual query rather than module import, so `next build` can import route
// modules during "Collecting page data" without a database URL present. Runtime
// still requires DATABASE_URL — the error just surfaces on first use, not import.
type Db = ReturnType<typeof drizzle<typeof schema>>;
let _db: Db | undefined;

function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. See packages/db/.env.example.');
  }
  const client = postgres(url, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
  });
  _db = drizzle(client, { schema });
  return _db;
}

// Proxy so existing `db.select(...)` / `db.transaction(...)` / `db.query.*` usage
// is unchanged, but the underlying client is only built on first property access.
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
}) as Db;

// Per-request RLS context setter.
// Call inside a transaction before executing queries.
//
// Drops to the `app_user` role for the transaction so RLS policies apply (without
// this, queries run as the superuser DATABASE_URL connects with and bypass RLS).
// Migrations, seeds, and direct ad-hoc queries skip this and run as superuser.
//
// Example:
//   await db.transaction(async (tx) => {
//     await setRequestContext(tx, { role: 'ward_coordinator', wardId: 'kongowea-uuid', personId: 'person-uuid' });
//     return tx.select().from(communityLeaders);
//   });
export async function setRequestContext(
  tx: typeof db,
  context: { role: string; wardId?: string; personId: string },
): Promise<void> {
  // Order matters: set encryption key first (so any app_encrypt/app_decrypt call
  // inside the transaction has it), then drop privileges, then set session vars.
  // SET LOCAL ROLE requires the current user to have the target role granted
  // (or to be a superuser). In local dev the connection user is the superuser.
  if (process.env.PGCRYPTO_KEY) {
    await tx.execute(
      `SET LOCAL app.encryption_key = '${process.env.PGCRYPTO_KEY.replace(/'/g, "''")}'`,
    );
  }
  await tx.execute(`SET LOCAL ROLE app_user`);
  await tx.execute(`SET LOCAL app.role = '${escapeIdentifier(context.role)}'`);
  if (context.wardId) {
    await tx.execute(`SET LOCAL app.ward_id = '${escapeUuid(context.wardId)}'`);
  }
  await tx.execute(`SET LOCAL app.person_id = '${escapeUuid(context.personId)}'`);
}

// SET LOCAL doesn't accept bind parameters, so we sanitize.
// Inputs come from JWT claims that the API has already validated — defence in depth.
function escapeIdentifier(value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return value;
}

function escapeUuid(value: string): string {
  if (!/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(value)) {
    throw new Error(`Invalid UUID: ${value}`);
  }
  return value;
}

export { schema };
export * from './schema/index';
