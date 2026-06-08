import { sql } from 'drizzle-orm';
import { date, index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { wards } from './geography';
import { pollingStations } from './geography';

// Voter register (DPA-sensitive).
//
// Source: campaign's own copy of the IEBC register subset for Nyali constituency,
// imported via /api/data-import/commit?entityType=voters when DPA_VOTER_INGEST_ENABLED is set.
//
// PII fields requiring pgcrypto encryption (applied in post-generate column-encryption migration):
//   - national_id
//   - phone
//   - date_of_birth (limited utility encrypted; kept clear because age-band stats need it
//                    and the column is already row-level-protected by RLS)
//
// RLS posture (Phase 6-aligned):
//   - candidate, campaign_manager, chief_strategist, constituency_coordinator → all rows
//   - ward_coordinator, assistant_ward_coordinator → their ward only
//   - canvasser, polling_agent → none directly; outreach happens via filtered queries
//   - tech_lead → all rows for admin / migration purposes (gated separately by env)
//
// Append-only? No — voters update (phone changes, ward reassignment, opt-out). Withdrawal of
// consent hard-nulls PII columns but keeps the row for ward-count totals (mirrors the existing
// committed_supporters pattern, DPA §26).

// SRS BR-130.1-style consent vocabulary.
export const voterGender = pgEnum('voter_gender', ['M', 'F', 'U']);

export const voterRegistrationSource = pgEnum('voter_registration_source', [
  'iebc_register',       // imported from official IEBC register subset
  'campaign_collected',  // self-collected with consent
  'public_event',        // collected at a campaign event with consent form
  'unknown',
]);

export const voters = pgTable(
  'voters',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    // Voter number from the IEBC register (NOT national ID — those are separate).
    voterNumber: text('voter_number').notNull(),
    // National ID — pgcrypto-encrypted in post-generate migration.
    nationalId: text('national_id'),
    surname: text('surname').notNull(),
    firstName: text('first_name').notNull(),
    // Held as a date (no time component). Used to compute age bands; rarely surfaced raw.
    dateOfBirth: date('date_of_birth'),
    gender: voterGender('gender').notNull().default('U'),
    // Kept as plain text — denormalised for fast filter, not authoritative. The wardId FK is.
    county: text('county').notNull().default('Mombasa'),
    constituency: text('constituency').notNull().default('Nyali'),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    pollingStationId: uuid('polling_station_id').references(() => pollingStations.id, {
      onDelete: 'set null',
    }),
    // Phone number normalised to E.164 (e.g. '+254723535594').
    // Stored as text here; column-encryption migration wraps with pgp_sym_encrypt later.
    phone: text('phone'),
    // The last 4 digits in plain text for UI display ('•••• 5594'). Computed at insert time.
    phoneTail: text('phone_tail'),
    registrationSource: voterRegistrationSource('registration_source').notNull().default('iebc_register'),
    // Soft consent state. Hard withdrawal nulls PII columns (national_id, phone, surname, firstName)
    // but keeps the row so ward-level counts remain accurate.
    consentWithdrawnAt: timestamp('consent_withdrawn_at', { withTimezone: true }),
    optedOutOfContact: timestamp('opted_out_of_contact', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    voterNumberUnique: unique('voters_voter_number_unique').on(t.voterNumber),
    wardIdx: index('voters_ward_idx').on(t.wardId),
    pollingStationIdx: index('voters_polling_station_idx').on(t.pollingStationId),
    surnameIdx: index('voters_surname_idx').on(t.surname),
    genderIdx: index('voters_gender_idx').on(t.gender),
    dobIdx: index('voters_dob_idx').on(t.dateOfBirth),
  }),
);

export type Voter = typeof voters.$inferSelect;
export type NewVoter = typeof voters.$inferInsert;
