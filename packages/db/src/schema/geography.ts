import { sql } from 'drizzle-orm';
import { boolean, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { geometryMultiPolygon, geometryPoint, geometryPolygon } from '../types/geometry';

// Geographic hierarchy (SRS §3.3, ARC §6).
//
//   constituency (1) → wards (5) → sub_locations (~30) → villages (dozens) → polling_stations (~100)
//
// Every level has either a centroid Point or a Polygon/MultiPolygon, plus the IEBC code
// where one exists. Polling station IEBC codes are unique and immutable — the canonical
// join key with IEBC data (SRS BR-010.2).

// ---- constituencies ---------------------------------------------------------

export const constituencies = pgTable('constituencies', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  iebcCode: text('iebc_code').notNull().unique(),  // e.g. '028' for Nyali
  name: text('name').notNull(),
  countyName: text('county_name').notNull(),       // 'Mombasa' for Nyali
  registeredVoters: integer('registered_voters'),
  boundary: geometryMultiPolygon('boundary'),
  centroid: geometryPoint('centroid'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ---- wards ------------------------------------------------------------------

export const wards = pgTable(
  'wards',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    constituencyId: uuid('constituency_id')
      .notNull()
      .references(() => constituencies.id, { onDelete: 'restrict' }),
    iebcCode: text('iebc_code').notNull(),
    name: text('name').notNull(),
    registeredVoters: integer('registered_voters'),
    populationEstimate: integer('population_estimate'),
    boundary: geometryMultiPolygon('boundary'),
    centroid: geometryPoint('centroid'),
    // Top issue is denormalised for fast ward-card render on Central Command homepage.
    // Recomputed nightly from village_issues aggregates.
    topIssueCategory: text('top_issue_category'),
    coveragePercent: integer('coverage_percent'),  // 0-100, recomputed from visits
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    iebcCodeUnique: unique('wards_iebc_code_unique').on(t.iebcCode),
    constituencyIdx: index('wards_constituency_idx').on(t.constituencyId),
  }),
);

// ---- sub_locations ----------------------------------------------------------

export const subLocations = pgTable(
  'sub_locations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),                  // census-level name
    boundary: geometryMultiPolygon('boundary'),
    centroid: geometryPoint('centroid'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    nameInWard: unique('sub_locations_ward_name_unique').on(t.wardId, t.name),
    wardIdx: index('sub_locations_ward_idx').on(t.wardId),
  }),
);

// ---- villages (mtaa) --------------------------------------------------------

export const villages = pgTable(
  'villages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    subLocationId: uuid('sub_location_id').references(() => subLocations.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    // Arbitrary-but-geographic grouping of a ward's villages into named clusters
    // (e.g. "Bamburi", "Bullo") for field planning + coordinator assignment.
    section: text('section'),
    aliases: text('aliases').array(),              // alternate spellings, swahili names
    // Boundaries are approximate for informal settlements (SRS BR-010.1).
    // Always have a centroid; polygon optional. UI must surface uncertainty.
    boundary: geometryPolygon('boundary'),
    centroid: geometryPoint('centroid').notNull(),
    populationEstimate: integer('population_estimate'),
    // FK to people.id enforced at the application layer (avoids cross-cluster import cycle).
    // A constraint migration can be added later if needed.
    assignedCoordinatorPersonId: uuid('assigned_coordinator_person_id'),
    // Soft-delete only (SRS AC-011.3) — only campaign_manager+ may delete.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    // SRS AC-011.4 — village name must be unique within a ward; duplicates trigger merge prompt.
    nameInWard: unique('villages_ward_name_unique').on(t.wardId, t.name),
    wardIdx: index('villages_ward_idx').on(t.wardId),
    centroidIdx: index('villages_centroid_idx').using('gist', t.centroid),
  }),
);

// ---- polling_stations -------------------------------------------------------

export const pollingStations = pgTable(
  'polling_stations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'restrict' }),
    subLocationId: uuid('sub_location_id').references(() => subLocations.id, {
      onDelete: 'set null',
    }),
    // SRS BR-010.2 — IEBC code is unique and immutable, the canonical join key.
    iebcCode: text('iebc_code').notNull().unique(),
    name: text('name').notNull(),
    location: geometryPoint('location').notNull(),
    registeredVoters: integer('registered_voters').notNull(),
    // Historical turnout percentages.
    turnout2013: integer('turnout_2013'),
    turnout2017: integer('turnout_2017'),
    turnout2022: integer('turnout_2022'),
    margin2022: integer('margin_2022'),            // candidate-favoured margin in raw votes
    targetTurnout: integer('target_turnout'),      // % target for D-Day
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    wardIdx: index('polling_stations_ward_idx').on(t.wardId),
    locationIdx: index('polling_stations_location_idx').using('gist', t.location),
  }),
);

// ---- roads ------------------------------------------------------------------
// The MP's road projects, listed village → village. Village FKs are app-layer
// (nullable). Free-text status/funding/surface kept simple for quick data entry.

export const roads = pgTable(
  'roads',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    wardId: uuid('ward_id').references(() => wards.id, { onDelete: 'set null' }),
    fromVillageId: uuid('from_village_id'),
    toVillageId: uuid('to_village_id'),
    name: text('name').notNull(),
    status: text('status'),          // proposed | ongoing | completed | stalled
    funding: text('funding'),        // ng_cdf | county | national | other
    mpProject: boolean('mp_project').notNull().default(true),
    surface: text('surface'),        // tarmac | murram | earth | cabro | graded
    lengthKm: numeric('length_km'),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    wardIdx: index('roads_ward_idx').on(t.wardId),
    fromIdx: index('roads_from_idx').on(t.fromVillageId),
    toIdx: index('roads_to_idx').on(t.toVillageId),
  }),
);

export type Constituency = typeof constituencies.$inferSelect;
export type Ward = typeof wards.$inferSelect;
export type SubLocation = typeof subLocations.$inferSelect;
export type Village = typeof villages.$inferSelect;
export type PollingStation = typeof pollingStations.$inferSelect;
export type Road = typeof roads.$inferSelect;
