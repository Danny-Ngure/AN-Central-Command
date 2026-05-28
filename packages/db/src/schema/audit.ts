import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid, inet } from 'drizzle-orm/pg-core';

// Append-only audit log (SRS NFR-050).
//
// Every meaningful action in the platform writes here. Reads of restricted data
// (committed_supporters, community_leaders contact details, sensitive notes) also write.
//
// CRITICAL: this table is append-only. A Postgres trigger denies UPDATE and DELETE for
// every role except the sealed-key `admin_audit` role. The trigger is installed in a
// post-generate migration step (see migrations/0001_audit_append_only.sql), NOT defined
// here in the Drizzle schema, because drizzle-kit's auto-generator doesn't produce role
// grants or RLS-affecting triggers.
//
// Retention: 7 years (SRS NFR-051, COMP-007).

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // When the action occurred. clock_timestamp() not now() — we want the actual wall-clock
  // moment, not the transaction start, so adjacent inserts inside the same tx order correctly.
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`clock_timestamp()`),
  actorPersonId: uuid('actor_person_id'),  // nullable for system / trigger-originated rows
  actorRole: text('actor_role').notNull(),
  // Action vocabulary is open-ended (CREATE_ISSUE, READ_LEADER_CONTACT, SUBMIT_TURNOUT_REPORT,
  // WITHDRAW_CONSENT, ...). Documented in docs/audit-actions.md (Phase 2 deliverable).
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),  // 'leader', 'supporter', 'station', ...
  entityId: uuid('entity_id'),
  // Before/after snapshots for mutations. JSON so we don't have to maintain a row-level
  // schema for every entity; consumers parse on read.
  beforeValue: jsonb('before_value'),
  afterValue: jsonb('after_value'),
  ipAddress: inet('ip_address'),
  // Free-form context: deviceFingerprint, requestId, sessionId, source ('app' | 'sms' | 'system')
  context: jsonb('context'),
});

// Indexes are added in a post-generate migration (drizzle-kit handles CREATE INDEX, but
// the GIN index on context jsonb is hand-tuned).
//
// Recommended indexes (NFR-053 monitoring queries depend on these):
//   - (timestamp DESC)
//   - (actor_person_id, timestamp DESC)
//   - (entity_type, entity_id, timestamp DESC)
//   - (action, timestamp DESC)
//   - GIN on context

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
