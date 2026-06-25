import { sql } from 'drizzle-orm';
import { index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { wards } from './geography';
import { voters } from './voters';

// Alfayo Flames Crew — named ward mobiliser roster.
//
// A hand-curated list of grassroots mobilisers (predominantly women's groups)
// supplied per ward by the campaign. Each member is cross-examined against the
// imported IEBC voter register: where a member is also a registered voter their
// `voter_id` is populated so their official voter data surfaces alongside the
// roster entry ("embedded in their clicked data").
//
// Matching strategy (tools/seed-flames-crew.cjs):
//   1. Exact phone match (E.164) within the member's ward — highest confidence.
//   2. Unique name match within the ward — all name tokens present in
//      "SURNAME FIRSTNAME" and exactly one candidate.
//   3. Otherwise left unmatched (matchMethod = 'unmatched') with an optional note
//      explaining why (no phone, malformed phone, or N ambiguous candidates).
//
// Not PII-restricted at the RLS layer (mirrors the `voters` table, which carries
// the heavier register and is gated by app_user grants rather than per-row RLS).
// The migration grants app_user CRUD explicitly.

export const flamesMatchMethod = pgEnum('flames_match_method', ['phone', 'name', 'unmatched']);

export const flamesCrew = pgTable(
  'flames_crew',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    // Position in the ward's supplied list (1-based).
    position: integer('position').notNull(),
    fullName: text('full_name').notNull(),
    // The phone exactly as supplied (may be blank, spaced, or malformed).
    rawPhone: text('raw_phone'),
    // Normalised E.164 phone, or null when the supplied value can't be normalised.
    phone: text('phone'),
    // Last 4 digits for masked display.
    phoneTail: text('phone_tail'),
    // Populated when the member is cross-matched to an IEBC voter row.
    voterId: uuid('voter_id').references(() => voters.id, { onDelete: 'set null' }),
    matchMethod: flamesMatchMethod('match_method').notNull().default('unmatched'),
    // Human-readable note when unmatched / ambiguous ("3 possible matches", etc.).
    matchNote: text('match_note'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    wardPositionUnique: unique('flames_crew_ward_position_unique').on(t.wardId, t.position),
    wardIdx: index('flames_crew_ward_idx').on(t.wardId),
    voterIdx: index('flames_crew_voter_idx').on(t.voterId),
    matchIdx: index('flames_crew_match_idx').on(t.matchMethod),
  }),
);

export type FlamesCrewMember = typeof flamesCrew.$inferSelect;
export type NewFlamesCrewMember = typeof flamesCrew.$inferInsert;
