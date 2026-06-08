import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { villages, wards } from './geography';
import { people } from './identity';
import { geometryPoint } from '../types/geometry';

// Community intelligence (SRS §3.4, FR-020 to FR-022, §3.5 FR-030).
//
// The strategic core of the platform. Community leaders are the canonical relationship
// graph — when a coordinator leaves, the relationship survives in this table (the
// original campaign-pain-point in SRS §0.1.3).
//
// Encrypted column (pgcrypto, post-generate migration):
//   - community_leaders.sensitive_notes  (NFR-012)
//
// Stricter access control (RLS, applied in a follow-up migration):
//   - community_leaders.sensitive_notes is visible only to candidate, campaign_manager,
//     chief_strategist, and the owning person (BR-020.2 / SRS rbac.notesGated).

// FR-020 IN-020.6
export const influenceReach = pgEnum('influence_reach', ['small', 'medium', 'large', 'unknown']);

// FR-020 IN-020.7
export const politicalLean = pgEnum('political_lean', [
  'supportive',
  'leaning_supportive',
  'neutral',
  'leaning_opposition',
  'opposition',
  'unknown',
]);

// FR-020 IN-020.8
export const relationshipTemperature = pgEnum('relationship_temperature', [
  'warm',
  'cool',
  'cold',
  'hostile',
  'not_approached',
]);

// FR-030 IN-030.5 (severity is reused by incidents in ./election)
export const issueSeverity = pgEnum('issue_severity', ['minor', 'moderate', 'serious', 'critical']);

export const issueStatus = pgEnum('issue_status', ['reported', 'investigating', 'resolved', 'dismissed']);

// ---- community_sites --------------------------------------------------------

export const communitySites = pgTable(
  'community_sites',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    // SRS AC-021.1 — site types are an open-ended controlled vocabulary; text + zod
    // validation at the API layer keeps it flexible without DB churn.
    type: text('type').notNull().$type<
      | 'church'
      | 'mosque'
      | 'madrasa'
      | 'school_primary'
      | 'school_secondary'
      | 'school_other'
      | 'market'
      | 'shopping_center'
      | 'boda_stage'
      | 'matatu_stage'
      | 'chama'
      | 'sacco'
      | 'self_help_group'
      | 'community_hall'
      | 'social_hall'
      | 'sports_club'
      | 'youth_center'
      | 'health_facility'
      | 'government_office'
      | 'other'
    >(),
    name: text('name').notNull(),
    location: geometryPoint('location').notNull(),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    villageId: uuid('village_id').references(() => villages.id, { onDelete: 'set null' }),
    // SRS FR-022 — boda stages track aggregate rider count, NOT individual riders.
    estimatedSize: integer('estimated_size'),
    meetingSchedule: text('meeting_schedule'),
    // FK below — same as ownedBy on leaders (FK to people but added later if needed).
    keyContactLeaderId: uuid('key_contact_leader_id'),
    // Contact details for the site itself — Imam, Pastor, Chairman, etc.
    // Separate from communityLeaders because not every site needs a full leader-graph entry.
    contactPersonName: text('contact_person_name'),
    contactPhone: text('contact_phone'),
    contactRole: text('contact_role'),                  // 'Imam' | 'Pastor' | 'Chairman' | ...
    areaName: text('area_name'),                        // free-text location label from coordinator PDFs
    politicalClimate: text('political_climate'),
    // Visited tracking — flipped per-site in the UI by ward coordinators / canvassers.
    // visitedAt is the most recent visit; lastVisitedAt was already here for the activities-driven
    // timeline. Keep both: `visited` is the simple "have we been here at least once?" flag.
    visited: boolean('visited').notNull().default(false),
    visitedAt: timestamp('visited_at', { withTimezone: true }),
    visitedByPersonId: uuid('visited_by_person_id'),
    // ~100-word coordinator note recorded on visit. App-layer caps at 600 chars.
    visitNotes: text('visit_notes'),
    // Target visit date set while still un-visited — feeds the upcoming-visits roster.
    plannedVisitAt: timestamp('planned_visit_at', { withTimezone: true }),
    // ── Structured post-visit assessment (required to flip `visited` on) ──
    visitPromises:        text('visit_promises'),
    visitBenefits:        text('visit_benefits'),
    visitResponse:        text('visit_response'),
    visitTemperature:     text('visit_temperature'),     // 'hot' | 'warm' | 'cold'
    visitRecommendation:  text('visit_recommendation'),  // 'high_priority' | 'normal' | 'low_priority'
    visitEffort:          text('visit_effort'),          // 'intensify' | 'maintain' | 'reduce'
    // ── Pre-visit plan questionnaire ──
    plannedPurpose:       text('planned_purpose'),
    plannedObjectives:    text('planned_objectives'),
    plannedAttendees:     text('planned_attendees'),
    lastVisitedAt: timestamp('last_visited_at', { withTimezone: true }),
    visitHistoryCount: integer('visit_history_count').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    wardIdx: index('community_sites_ward_idx').on(t.wardId),
    locationIdx: index('community_sites_location_idx').using('gist', t.location),
    typeIdx: index('community_sites_type_idx').on(t.type),
  }),
);

// ---- community_leaders ------------------------------------------------------

export const communityLeaders = pgTable(
  'community_leaders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    whatsappPhone: text('whatsapp_phone'),
    email: text('email'),
    // Free-text role title: 'Imam (Kongowea Mosque)', 'Boda Boda Chairman (Kadzandani Stage)', etc.
    roleTitle: text('role_title').notNull(),
    affiliatedSiteId: uuid('affiliated_site_id').references(() => communitySites.id, {
      onDelete: 'set null',
    }),
    villageId: uuid('village_id')
      .notNull()
      .references(() => villages.id, { onDelete: 'restrict' }),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    influenceReach: influenceReach('influence_reach').notNull().default('unknown'),
    politicalLean: politicalLean('political_lean').notNull().default('unknown'),
    relationshipTemperature: relationshipTemperature('relationship_temperature')
      .notNull()
      .default('not_approached'),
    // SRS BR-020.1 — every leader has an owner; transfers are audit-logged.
    ownedByPersonId: uuid('owned_by_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    // SRS NFR-012 — pgcrypto-encrypted in post-generate migration.
    // Stored as text here; encryption wrap (pgp_sym_encrypt/decrypt) applied per-query.
    sensitiveNotes: text('sensitive_notes'),
    // SRS AC-020.2 — canvasser-submitted leaders enter the review queue.
    // Ward coordinator approval flips this to false.
    isQueuedForReview: boolean('is_queued_for_review').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    wardIdx: index('community_leaders_ward_idx').on(t.wardId),
    villageIdx: index('community_leaders_village_idx').on(t.villageId),
    ownerIdx: index('community_leaders_owner_idx').on(t.ownedByPersonId),
    queueIdx: index('community_leaders_queue_idx').on(t.isQueuedForReview),
  }),
);

// ---- village_issues ---------------------------------------------------------

export const villageIssues = pgTable(
  'village_issues',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    villageId: uuid('village_id')
      .notNull()
      .references(() => villages.id, { onDelete: 'restrict' }),
    // Denormalised for fast ward-level filtering (FR-030 AC-030.4).
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    // SRS BR-030.1 — controlled vocabulary with 20+ values. Kept as text so new categories
    // can be added without ALTER TYPE; zod schemas in @an/api-client enforce validity.
    category: text('category').notNull().$type<
      | 'water'
      | 'sanitation'
      | 'garbage'
      | 'drainage'
      | 'roads'
      | 'street_lighting'
      | 'electricity'
      | 'security'
      | 'drugs_substance_abuse'
      | 'gbv'
      | 'youth_unemployment'
      | 'education'
      | 'healthcare'
      | 'land_disputes'
      | 'housing'
      | 'business_permits'
      | 'agriculture'
      | 'fishing'
      | 'environmental'
      | 'corruption'
      | 'service_delivery'
      | 'other'
    >(),
    // SRS IN-030.3 — max 120 chars enforced via check constraint in post-generate migration.
    title: text('title').notNull(),
    description: text('description'),
    severity: issueSeverity('severity').notNull(),
    affectsEstimatedVoters: integer('affects_estimated_voters'),
    status: issueStatus('status').notNull().default('reported'),
    adminResponsiveness: text('admin_responsiveness'),
    candidatePosition: text('candidate_position'),
    // SRS AC-020.2 pattern — canvasser-submitted issues entering verified=false
    // until a ward coordinator+ reviews.
    verified: boolean('verified').notNull().default(false),
    // SRS AC-030.3 — issues not verified within 90 days are flagged 'stale' in queries.
    lastVerifiedAt: date('last_verified_at'),
    reportedByPersonId: uuid('reported_by_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    villageIdx: index('village_issues_village_idx').on(t.villageId),
    wardIdx: index('village_issues_ward_idx').on(t.wardId),
    categoryIdx: index('village_issues_category_idx').on(t.category),
    severityStatusIdx: index('village_issues_severity_status_idx').on(t.severity, t.status),
  }),
);

export type CommunitySite = typeof communitySites.$inferSelect;
export type CommunityLeader = typeof communityLeaders.$inferSelect;
export type VillageIssue = typeof villageIssues.$inferSelect;
