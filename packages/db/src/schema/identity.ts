import { sql } from 'drizzle-orm';
import { boolean, index, inet, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { wards } from './geography';

// Identity, authentication, sessions (SRS FR-001 to FR-004, §2.2).
//
// `people` is the campaign-team directory. Community leaders are a separate table
// (see ./community) because they are not platform users. Voters are a separate table
// (not modelled in v1.0 MVP — voter lookups go through IEBC reference data).
//
// Encrypted columns (pgcrypto, post-generate migration adds the encryption wrap):
//   - people.national_id
//   - auth_credentials.totp_secret

// 15 roles from SRS §2.2. Stable; encode as enum for indexability and RLS clarity.
export const campaignRole = pgEnum('campaign_role', [
  'candidate',
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'media_head',
  'comms_head',
  'patron_ceo',
  'ward_coordinator',
  'assistant_ward_coordinator',
  'polling_station_lead',
  'polling_agent',
  'canvasser',
  'influence_liaison',
  'tech_lead',
  'finance_lead',
]);

// ---- people -----------------------------------------------------------------

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    // Phone is the primary auth identifier in Kenya context (FR-001 IN-001.1).
    phone: text('phone').notNull(),
    email: text('email'),
    // National ID is pgcrypto-encrypted in a post-generate migration (NFR-012).
    // Stored as text here; the wrap (pgp_sym_encrypt/decrypt) is applied per-query
    // by the API layer.
    nationalId: text('national_id'),
    fullName: text('full_name').notNull(),
    role: campaignRole('role').notNull(),
    // Null for constituency-wide roles (candidate, campaign_manager, chief_strategist,
    // constituency_coordinator, media_head, comms_head, patron_ceo, tech_lead, finance_lead).
    wardId: uuid('ward_id').references(() => wards.id, { onDelete: 'restrict' }),
    photoUrl: text('photo_url'),
    active: boolean('active').notNull().default(true),
    // SRS FR-080 AC-080.1 — "Active in last 7 days" indicator on the team directory.
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    phoneUnique: unique('people_phone_unique').on(t.phone),
    emailUnique: unique('people_email_unique').on(t.email),
    wardIdx: index('people_ward_idx').on(t.wardId),
    roleIdx: index('people_role_idx').on(t.role),
  }),
);

// ---- auth_credentials -------------------------------------------------------

export const authCredentials = pgTable(
  'auth_credentials',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    // Argon2id hash (ARC §7).
    passwordHash: text('password_hash').notNull(),
    // pgcrypto-encrypted TOTP secret (NFR-012).
    totpSecret: text('totp_secret'),
    totpEnrolledAt: timestamp('totp_enrolled_at', { withTimezone: true }),
    // SRS AC-001.3 — 5 consecutive failures → 30 min lockout.
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }).notNull().default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    personUnique: unique('auth_credentials_person_unique').on(t.personId),
  }),
);

// ---- sessions ---------------------------------------------------------------

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    // Opaque token or JWT. Stored hashed in a post-generate migration if treated as bearer.
    token: text('token').notNull(),
    deviceFingerprint: text('device_fingerprint'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    // SRS BR-001.3 — 24h web, 7d mobile.
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // SRS FR-003 — admin revocation sets this; subsequent API calls return 401.
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    tokenUnique: unique('sessions_token_unique').on(t.token),
    personIdx: index('sessions_person_idx').on(t.personId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type AuthCredential = typeof authCredentials.$inferSelect;
export type Session = typeof sessions.$inferSelect;
