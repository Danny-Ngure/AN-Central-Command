import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { villages, wards } from './geography';
import { people } from './identity';
import { geometryPoint } from '../types/geometry';

// Activities, visits, meetings (SRS §3.6 FR-040, §3.7 FR-050, §3.8 FR-060).
//
// `visits` are APPEND-ONLY (SRS BR-050.1) — no edits after submission, only annotations.
// Activities and meetings are mutable.

export const activityStatus = pgEnum('activity_status', [
  'planned',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);

export const meetingType = pgEnum('meeting_type', [
  'internal_strategy',
  'community_baraza',
  'stakeholder',
  'condolence_visit',
  'harambee',
  'courtesy_call',
  'media',
]);

export const meetingStatus = pgEnum('meeting_status', [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
]);

// ---- activities -------------------------------------------------------------

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    title: text('title').notNull(),
    // SRS AC-040.1 — 21-value controlled vocabulary. Kept as text + zod validation;
    // see `apps/web` route handlers for enforcement.
    type: text('type').notNull().$type<
      | 'rally'
      | 'baraza'
      | 'community_meeting'
      | 'town_hall'
      | 'mosque_visit'
      | 'church_visit'
      | 'madrasa_visit'
      | 'boda_stage_stop'
      | 'market_visit'
      | 'chama_meeting'
      | 'door_to_door'
      | 'youth_event'
      | 'women_event'
      | 'harambee'
      | 'condolence_visit'
      | 'wedding_attendance'
      | 'courtesy_call'
      | 'media_engagement'
      | 'launch_event'
      | 'internal_strategy'
      | 'training'
      | 'other'
    >(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    locationName: text('location_name'),
    locationCoords: geometryPoint('location_coords'),
    // Null for constituency-wide; ward-level for ward activities; village-level for door-to-door.
    wardId: uuid('ward_id').references(() => wards.id, { onDelete: 'restrict' }),
    villageId: uuid('village_id').references(() => villages.id, { onDelete: 'set null' }),
    ownerPersonId: uuid('owner_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    status: activityStatus('status').notNull().default('planned'),
    expectedAttendance: integer('expected_attendance'),
    actualAttendance: integer('actual_attendance'),
    candidateAttended: boolean('candidate_attended').notNull().default(false),
    outcomeNotes: text('outcome_notes'),
    followUpRequired: boolean('follow_up_required').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    scheduledIdx: index('activities_scheduled_idx').on(t.scheduledAt),
    ownerIdx: index('activities_owner_idx').on(t.ownerPersonId),
    wardIdx: index('activities_ward_idx').on(t.wardId),
    statusIdx: index('activities_status_idx').on(t.status),
  }),
);

// ---- visits — APPEND-ONLY (SRS BR-050.1) ------------------------------------

export const visits = pgTable(
  'visits',
  {
    // Client-generated UUIDv7 for offline idempotency (SRS §5.3, ARC §8).
    // Server uses ON CONFLICT DO NOTHING — the same submission retried any number
    // of times produces exactly one row.
    id: uuid('id').primaryKey(),
    visitingPersonId: uuid('visiting_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    location: geometryPoint('location').notNull(),
    // SRS AC-050.2 — auto-suggested from location; user can override.
    villageId: uuid('village_id').references(() => villages.id, { onDelete: 'set null' }),
    purpose: text('purpose').notNull().$type<
      | 'door_to_door'
      | 'courtesy_call'
      | 'baraza'
      | 'leader_meeting'
      | 'site_assessment'
      | 'follow_up'
      | 'other'
    >(),
    engagementCount: integer('engagement_count'),
    notes: text('notes'),
    // Append-only: no updatedAt, no deletedAt. BR-050.1 forbids edits.
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    personIdx: index('visits_person_idx').on(t.visitingPersonId),
    villageIdx: index('visits_village_idx').on(t.villageId),
    createdIdx: index('visits_created_idx').on(t.createdAt),
    locationIdx: index('visits_location_idx').using('gist', t.location),
  }),
);

// ---- meetings ---------------------------------------------------------------

export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    title: text('title').notNull(),
    type: meetingType('type').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    location: text('location'),
    agenda: text('agenda'),
    ownerPersonId: uuid('owner_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    status: meetingStatus('status').notNull().default('scheduled'),
    // Array of person IDs invited. FK-enforced via application validation; Postgres
    // doesn't support FK constraints on array columns natively.
    inviteePersonIds: uuid('invitee_person_ids').array().notNull().default(sql`'{}'::uuid[]`),
    // SRS BR-060.1 — stakeholder notification list per organisation.
    stakeholderNotifiedPersonIds: uuid('stakeholder_notified_person_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    outcomeNotes: text('outcome_notes'),
    // SRS AC-060.5 — past meetings without outcome notes after 48h are flagged.
    outcomeFlaggedAt: timestamp('outcome_flagged_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    scheduledIdx: index('meetings_scheduled_idx').on(t.scheduledAt),
    ownerIdx: index('meetings_owner_idx').on(t.ownerPersonId),
    statusIdx: index('meetings_status_idx').on(t.status),
  }),
);

export type Activity = typeof activities.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
export type Meeting = typeof meetings.$inferSelect;
