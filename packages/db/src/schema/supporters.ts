import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pollingStations, villages, wards } from './geography';
import { people } from './identity';

// Committed Supporter Network (SRS §3.15 FR-130 to FR-134, COMP-010).
//
// THE MOST SENSITIVE DATA IN THE PLATFORM.
//
// Records link named voters to participation in community programs, which under
// the Kenya Data Protection Act 2019 §44–45 is sensitive personal data requiring
// elevated lawful basis, explicit consent, and additional safeguards.
//
// Three production gates before any record can be created (SRS COMP-010):
//   Gate 1: ODPC Data Controller registration confirmed (DEP-002).
//   Gate 2: DPIA produced and signed (COMP-008).
//   Gate 3: Data Protection Officer confirms DPA §44–45 lawful basis in writing.
//
// Access control rules baked into RLS policies (post-generate migration):
//   - Visible only to: candidate, campaign_manager, chief_strategist,
//     constituency_coordinator, and the assigning ward_coordinator (AC-130.4).
//   - Other ward coordinators do NOT see another ward's supporters.
//   - Polling agents and canvassers: empty result set.
//   - 404 (not 403) on unauthorised reads — avoids confirming record existence (ERR-130.2).
//   - Bulk export requires campaign_manager approval (AC-130.6).
//
// The consent_log is append-only; every consent event (capture, re-verification,
// withdrawal) is permanently recorded.

// SRS FR-130 BR-130.2 — four tiers, set explicitly by the registering coordinator.
export const commitmentTier = pgEnum('commitment_tier', [
  'strong_commit',  // explicit verbal commitment + ongoing relationship
  'likely',         // positive engagement, no explicit commitment
  'probable',       // program beneficiary without explicit political conversation
  'unverified',     // relationship inferred but not confirmed
]);

// SRS FR-130 IN-130.5
export const consentCaptureMethod = pgEnum('consent_capture_method', [
  'verbal_witnessed',
  'written_signed',
  'sms_confirmed',
  'in_person_app',
]);

// FR-134 — events appended to consent_log.
export const consentEventType = pgEnum('consent_event_type', [
  'capture',          // initial registration
  're_verification',  // FR-133 — 90-day re-check
  'withdrawal',       // FR-134 — DPA §26 right to erasure
]);

// ---- community_programs (FR-131) --------------------------------------------

export const communityPrograms = pgTable(
  'community_programs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    // SRS AC-131.1 — 11 program types. Cash-for-votes programs are PROHIBITED
    // (BR-131.1, Kenyan election law) — application-layer validation rejects
    // any attempt to create those; not modelled at the schema level.
    type: text('type').notNull().$type<
      | 'bursary'
      | 'harambee'
      | 'water_project'
      | 'sanitation_project'
      | 'women_group_support'
      | 'youth_program'
      | 'medical_support'
      | 'sports_sponsorship'
      | 'religious_donation'
      | 'agricultural_input'
      | 'business_capital'
      | 'other'
    >(),
    description: text('description'),
    // Programs can be ward-scoped or constituency-wide. Multi-ward programs
    // use the array; single-ward use a single-element array.
    wardScope: uuid('ward_scope').array().notNull().default(sql`'{}'::uuid[]`),
    villageScope: uuid('village_scope').array().notNull().default(sql`'{}'::uuid[]`),
    leadCoordinatorPersonId: uuid('lead_coordinator_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    estimatedBeneficiaryCount: integer('estimated_beneficiary_count'),
    startedAt: date('started_at').notNull(),
    endedAt: date('ended_at'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    typeIdx: index('community_programs_type_idx').on(t.type),
    coordinatorIdx: index('community_programs_coordinator_idx').on(t.leadCoordinatorPersonId),
  }),
);

// ---- committed_supporters (FR-130) — RESTRICTED -----------------------------

export const committedSupporters = pgTable(
  'committed_supporters',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    // Voter identity (FR-130 IN-130.1). Voter table not modelled in v1.0 MVP
    // (CON-009 — never store full voter register on devices). Embed minimum here.
    fullName: text('full_name').notNull(),
    // National ID is pgcrypto-encrypted in post-generate migration (NFR-012).
    // Stored masked in the column for display ('1234****'); the encrypted full value
    // lives in a separate encrypted column added by the migration.
    nationalIdMasked: text('national_id_masked'),
    phone: text('phone'),
    pollingStationId: uuid('polling_station_id')
      .notNull()
      .references(() => pollingStations.id, { onDelete: 'restrict' }),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    villageId: uuid('village_id').references(() => villages.id, { onDelete: 'set null' }),
    communityProgramId: uuid('community_program_id')
      .notNull()
      .references(() => communityPrograms.id, { onDelete: 'restrict' }),
    commitmentTier: commitmentTier('commitment_tier').notNull(),
    // SRS BR-020.1 pattern — every record has a registering person.
    // RLS policy uses this for canvasser scoping (canvasser sees only their own).
    registeringPersonId: uuid('registering_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    // SRS BR-130.1 — mandatory consent metadata. Application rejects insert without it.
    consentCaptureMethod: consentCaptureMethod('consent_capture_method').notNull(),
    consentCapturedAt: timestamp('consent_captured_at', { withTimezone: true }).notNull(),
    // SRS FR-133 — flagged stale if not re-verified within 90 days.
    lastVerifiedDate: date('last_verified_date').notNull(),
    // SRS FR-134 — soft withdrawal. Hard erasure is a separate operation that
    // anonymises PII fields rather than removing the row (DPA §26).
    withdrawn: boolean('withdrawn').notNull().default(false),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    pollingStationIdx: index('committed_supporters_polling_station_idx').on(t.pollingStationId),
    wardIdx: index('committed_supporters_ward_idx').on(t.wardId),
    programIdx: index('committed_supporters_program_idx').on(t.communityProgramId),
    registeringIdx: index('committed_supporters_registering_idx').on(t.registeringPersonId),
    tierIdx: index('committed_supporters_tier_idx').on(t.commitmentTier),
    withdrawnIdx: index('committed_supporters_withdrawn_idx').on(t.withdrawn),
  }),
);

// ---- consent_log (FR-130 POST-130.2, FR-134) — APPEND-ONLY ------------------

export const consentLog = pgTable(
  'consent_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    supporterId: uuid('supporter_id')
      .notNull()
      .references(() => committedSupporters.id, { onDelete: 'restrict' }),
    eventType: consentEventType('event_type').notNull(),
    // For capture: matches the supporter row's method.
    // For re-verification: method of the conversation.
    // For withdrawal: how the withdrawal request was received.
    method: consentCaptureMethod('method'),
    actorPersonId: uuid('actor_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    // FR-134 specifics — for withdrawal events.
    requestSource: text('request_source'),    // 'phone', 'email', 'in_person', 'sms'
    outcomeNotes: text('outcome_notes'),      // 'soft-withdrawn', 'hard-erased', etc.
    // Append-only — no updatedAt, no deletedAt.
    // Append-only constraint is enforced by the same trigger pattern as audit_log
    // (post-generate migration). UPDATE/DELETE denied except for sealed admin_audit role.
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    supporterIdx: index('consent_log_supporter_idx').on(t.supporterId),
    eventTypeIdx: index('consent_log_event_type_idx').on(t.eventType),
    createdIdx: index('consent_log_created_idx').on(t.createdAt),
  }),
);

export type CommunityProgram = typeof communityPrograms.$inferSelect;
export type CommittedSupporter = typeof committedSupporters.$inferSelect;
export type NewCommittedSupporter = typeof committedSupporters.$inferInsert;
export type ConsentLogEntry = typeof consentLog.$inferSelect;
