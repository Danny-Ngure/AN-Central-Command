import { uuidv7 } from 'uuidv7';

// UUIDv7 — sortable, timestamp-prefixed UUIDs that double as offline-safe
// idempotency keys (SRS §5.3, ARC §8). The server's ON CONFLICT DO NOTHING
// turns a retried submission with the same UUID into a no-op.

export function newUuid(): string {
  return uuidv7();
}
