import * as SQLite from 'expo-sqlite';
import { apiPost, ApiError } from './api-client';

// Offline-first outbox (SRS FR-100, CON-008).
//
// Every mutation submitted from the Field App goes through this queue. The flow:
//
//   1. UI calls enqueueVisit(payload) — payload includes the client-generated UUIDv7.
//   2. Row written to local SQLite (outbox_visits) with status='pending'. Survives
//      app restart, low-memory eviction, OS-killed-in-background.
//   3. UI optimistically displays the visit as "logged" and returns to the caller.
//   4. syncOutbox() drains pending rows against the server. Called automatically:
//        - right after enqueue (best-effort)
//        - on app foreground (wired by callers)
//        - by user-triggered pull-to-refresh
//        - eventually on connectivity restore (NetInfo — wired in next commit)
//   5. Each successful POST marks the row status='synced' (kept for history).
//   6. Each failure increments attempts; row stays 'pending' until 5 attempts
//      then flips to 'failed' (user-visible, manual retry).
//
// Idempotency: the same UUID retried produces no duplicate row server-side because
// the POST endpoint uses ON CONFLICT DO NOTHING on the primary key. Safe to retry.

const DB_NAME = 'an_field_outbox.db';

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
    _db.execSync(`
      CREATE TABLE IF NOT EXISTS outbox_visits (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        synced_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS outbox_visits_status_idx ON outbox_visits (status);
    `);
  }
  return _db;
}

export interface VisitPayload {
  id: string;                 // client-generated UUIDv7
  location: { lng: number; lat: number };
  villageId?: string | null;  // optional — nearest village lookup is server-side
  purpose:
    | 'door_to_door'
    | 'courtesy_call'
    | 'baraza'
    | 'leader_meeting'
    | 'site_assessment'
    | 'follow_up'
    | 'other';
  engagementCount?: number;
  notes?: string;
}

export type OutboxStatus = 'pending' | 'synced' | 'failed';

export interface OutboxRow {
  id: string;
  payload: VisitPayload;
  status: OutboxStatus;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  syncedAt: number | null;
}

/** Insert into the outbox and kick off a best-effort sync. */
export async function enqueueVisit(payload: VisitPayload): Promise<void> {
  db().runSync(
    `INSERT OR IGNORE INTO outbox_visits (id, payload, status, created_at, attempts)
     VALUES (?, ?, 'pending', ?, 0)`,
    [payload.id, JSON.stringify(payload), Date.now()],
  );
  // Fire-and-forget sync. Failure is fine — it's still in the queue, will retry.
  syncOutbox().catch(() => undefined);
}

export function getPendingCount(): number {
  const row = db().getFirstSync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM outbox_visits WHERE status = 'pending'`,
  );
  return row?.c ?? 0;
}

export function getFailedCount(): number {
  const row = db().getFirstSync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM outbox_visits WHERE status = 'failed'`,
  );
  return row?.c ?? 0;
}

export function listRecent(limit = 20): OutboxRow[] {
  const rows = db().getAllSync<{
    id: string;
    payload: string;
    status: OutboxStatus;
    created_at: number;
    attempts: number;
    last_error: string | null;
    synced_at: number | null;
  }>(
    `SELECT id, payload, status, created_at, attempts, last_error, synced_at
     FROM outbox_visits
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    payload: JSON.parse(r.payload) as VisitPayload,
    status: r.status,
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error,
    syncedAt: r.synced_at,
  }));
}

const MAX_ATTEMPTS = 5;
const SYNC_BATCH = 50;

/**
 * Drain pending rows against the server. Returns counts. Safe to call concurrently —
 * the in-flight rows are sent serially within one call, but two concurrent calls
 * are protected by ON CONFLICT DO NOTHING (server) and INSERT OR IGNORE (local).
 */
export async function syncOutbox(): Promise<{ ok: number; failed: number; remaining: number }> {
  const pending = db().getAllSync<{ id: string; payload: string; attempts: number }>(
    `SELECT id, payload, attempts FROM outbox_visits WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
    [SYNC_BATCH],
  );

  let ok = 0;
  let failed = 0;

  for (const row of pending) {
    let payload: VisitPayload;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      db().runSync(
        `UPDATE outbox_visits SET status = 'failed', last_error = 'corrupt payload' WHERE id = ?`,
        [row.id],
      );
      failed += 1;
      continue;
    }

    try {
      await apiPost('/api/visits', payload);
      db().runSync(
        `UPDATE outbox_visits SET status = 'synced', synced_at = ?, attempts = attempts + 1 WHERE id = ?`,
        [Date.now(), row.id],
      );
      ok += 1;
    } catch (err) {
      const attempts = row.attempts + 1;
      const status: OutboxStatus = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      const message = err instanceof ApiError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : 'unknown';
      db().runSync(
        `UPDATE outbox_visits SET status = ?, attempts = ?, last_error = ? WHERE id = ?`,
        [status, attempts, message, row.id],
      );
      failed += 1;
      // If this is a server-validation error (4xx), other rows will likely also
      // fail — but they're independent submissions, so keep going.
    }
  }

  const remaining = getPendingCount();
  return { ok, failed, remaining };
}

/** Reset a failed row back to pending so it'll retry on the next sync. */
export function retryFailed(id: string): void {
  db().runSync(
    `UPDATE outbox_visits SET status = 'pending', attempts = 0, last_error = NULL WHERE id = ?`,
    [id],
  );
}

/** Wipe the local outbox. For dev / sign-out only. */
export function clearOutbox(): void {
  db().execSync(`DELETE FROM outbox_visits`);
}
