import { sql } from 'drizzle-orm';
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pollingStations } from './geography';
import { people } from './identity';
import { issueSeverity } from './community';
import { geometryPoint } from '../types/geometry';

// Election-day operations (SRS §3.14 FR-120 to FR-122).
//
// Both tables are effectively APPEND-ONLY:
//   - station_reports: every report is a new row; no edits.
//   - incidents: status updates are mutations, but the record itself never deletes.
//
// On election day 9 August 2027 this cluster carries 500 concurrent users for 4 hours
// (NFR-007). Indexes here are chosen for the war-room read pattern:
//   "show me all reports for polling station X in time-order" → (station, created DESC)
//   "show me critical incidents not yet escalated" → (severity, status)

// SRS FR-120 — what an agent submits during the day.
export const stationReportType = pgEnum('station_report_type', [
  'check_in',         // 06:00 agent check-in
  'hourly_turnout',   // running turnout count
  'materials_status', // queue length, ballot supply, etc.
  'closing_count',    // end-of-day result
]);

// SRS FR-122 — submission source. SMS short-code falls into the same table with source='sms'.
export const reportSource = pgEnum('report_source', ['app', 'sms']);

// SRS FR-121 — incident categories.
export const incidentCategory = pgEnum('incident_category', [
  'voter_intimidation',
  'agent_obstruction',
  'ballot_issue',
  'materials_shortage',
  'violence',
  'dispute',
  'technical_failure',
  'other',
]);

export const incidentStatus = pgEnum('incident_status', [
  'reported',
  'investigating',
  'resolved',
  'escalated',
]);

// ---- station_reports (FR-120) — APPEND-ONLY ---------------------------------

export const stationReports = pgTable(
  'station_reports',
  {
    // Client-generated UUIDv7 for offline idempotency. SMS submissions get a
    // server-generated UUID at parse time.
    id: uuid('id').primaryKey(),
    pollingStationId: uuid('polling_station_id')
      .notNull()
      .references(() => pollingStations.id, { onDelete: 'restrict' }),
    // Agent is the FK; for SMS-source reports the gateway maps phone → person via
    // a separate lookup before insert.
    agentPersonId: uuid('agent_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    reportType: stationReportType('report_type').notNull(),
    // For hourly_turnout: cumulative voters who have voted.
    // For closing_count: total turnout for the day.
    turnoutCount: integer('turnout_count'),
    // Free-form notes — materials_status uses this for "ballots running low".
    notes: text('notes'),
    source: reportSource('source').notNull().default('app'),
    // Append-only — no updatedAt, no deletedAt.
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    // Primary war-room read pattern: report timeline per station.
    stationCreatedIdx: index('station_reports_station_created_idx').on(
      t.pollingStationId,
      t.createdAt,
    ),
    agentIdx: index('station_reports_agent_idx').on(t.agentPersonId),
    typeIdx: index('station_reports_type_idx').on(t.reportType),
  }),
);

// ---- incidents (FR-121) -----------------------------------------------------

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    pollingStationId: uuid('polling_station_id')
      .notNull()
      .references(() => pollingStations.id, { onDelete: 'restrict' }),
    reportedByPersonId: uuid('reported_by_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    category: incidentCategory('category').notNull(),
    // Reuses the issueSeverity enum from community — same 4-value vocabulary,
    // same semantics (minor/moderate/serious/critical).
    severity: issueSeverity('severity').notNull(),
    description: text('description').notNull(),
    // Optional photo URL (Supabase Storage / S3 path per SRS §5.1).
    photoUrl: text('photo_url'),
    // Captured at submission; usually matches the polling station but can differ
    // for surrounding-area incidents.
    location: geometryPoint('location'),
    status: incidentStatus('status').notNull().default('reported'),
    // SRS AC-121.2 — critical-severity incidents trigger push + WhatsApp escalation
    // to ward and constituency coordinators within 30 seconds. Timestamp recorded here.
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNotes: text('resolution_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    stationIdx: index('incidents_station_idx').on(t.pollingStationId),
    severityStatusIdx: index('incidents_severity_status_idx').on(t.severity, t.status),
    createdIdx: index('incidents_created_idx').on(t.createdAt),
  }),
);

export type StationReport = typeof stationReports.$inferSelect;
export type NewStationReport = typeof stationReports.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
