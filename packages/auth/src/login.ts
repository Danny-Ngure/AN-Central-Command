import { authCredentials, db, people } from '@an/db';
import { eq, sql } from 'drizzle-orm';
import { verifyPassword } from './passwords';
import { verifyTotp } from './totp';
import { checkAuthRateLimit, recordAuthFailure, resetAuthAttempts } from './rate-limit';
import { createSession, type SessionTokens } from './sessions';
import { signEnrollmentStep1Jwt } from './enrollment';

// Orchestrated login flow (SRS FR-001).
//
// Sequence per ARC §7:
//   1. Rate-limit check against Redis (NFR-013) before any DB query.
//   2. Find person by phone or email.
//   3. Load auth_credentials.
//   4. Check DB-level lockout (long-term lock complementary to Redis short-term).
//   5. Verify password (Argon2id).
//   6. If role requires 2FA (BR-001.2), verify TOTP code.
//   7. Reset Redis attempt counter, create session.
//
// Returns a discriminated union — caller maps error codes to HTTP statuses per
// SRS FR-001 ERR-001.*.

// Roles requiring 2FA on every login (SRS BR-001.2).
const ROLES_REQUIRING_2FA: ReadonlySet<string> = new Set([
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'ward_coordinator',
  'assistant_ward_coordinator',
  'polling_station_lead',
  'tech_lead',
]);

// SRS BR-001.3: session TTLs.
const SESSION_TTL_WEB_SECONDS = 24 * 60 * 60;
const SESSION_TTL_MOBILE_SECONDS = 7 * 24 * 60 * 60;

const FAILED_ATTEMPTS_BEFORE_DB_LOCKOUT = 5;
const DB_LOCKOUT_DURATION_MS = 30 * 60 * 1000;

export type LoginErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'AUTH_2FA_REQUIRED'
  | 'AUTH_2FA_INVALID'
  | 'AUTH_2FA_NOT_ENROLLED'
  | 'AUTH_RATE_LIMITED';

export interface LoginInput {
  /** Raw user input. Either a phone number ('+254...') or an email. */
  phoneOrEmail: string;
  password: string;
  /** Required when the user's role triggers ROLES_REQUIRING_2FA. */
  totpCode?: string;
  client: 'web' | 'mobile';
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

export type LoginResult =
  | {
      ok: true;
      session: SessionTokens;
      person: { id: string; role: string; wardId: string | null };
    }
  | {
      ok: false;
      code: LoginErrorCode;
      /** Seconds until the caller may retry. Set for rate-limit / lockout cases. */
      retryAfterSeconds?: number;
      /** Set when code === 'AUTH_2FA_NOT_ENROLLED'. Hand to the enrollment flow. */
      enrollmentToken?: string;
    };

export async function login(input: LoginInput): Promise<LoginResult> {
  // (1) Rate limit.
  const rate = await checkAuthRateLimit(input.phoneOrEmail);
  if (!rate.allowed) {
    return {
      ok: false,
      code: rate.reason === 'locked_out' ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_RATE_LIMITED',
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  // (2) Find the person.
  const personRows = await db
    .select()
    .from(people)
    .where(
      sql`(${people.phone} = ${input.phoneOrEmail} OR ${people.email} = ${input.phoneOrEmail})
          AND ${people.active} = true
          AND ${people.deletedAt} IS NULL`,
    )
    .limit(1);

  if (personRows.length === 0) {
    await recordAuthFailure(input.phoneOrEmail);
    // SRS ERR-001.1 — same error whether user or password was wrong.
    return { ok: false, code: 'AUTH_INVALID_CREDENTIALS' };
  }
  const person = personRows[0];

  // (3) Load credentials.
  const credentialRows = await db
    .select()
    .from(authCredentials)
    .where(eq(authCredentials.personId, person.id))
    .limit(1);

  if (credentialRows.length === 0) {
    await recordAuthFailure(input.phoneOrEmail);
    return { ok: false, code: 'AUTH_INVALID_CREDENTIALS' };
  }
  const cred = credentialRows[0];

  // (4) DB-level lockout check (in addition to Redis short-term).
  if (cred.lockedUntil && cred.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      code: 'AUTH_ACCOUNT_LOCKED',
      retryAfterSeconds: Math.ceil((cred.lockedUntil.getTime() - Date.now()) / 1000),
    };
  }

  // (5) Verify password.
  const passwordOk = await verifyPassword(input.password, cred.passwordHash);
  if (!passwordOk) {
    await recordAuthFailure(input.phoneOrEmail);
    const nextCount = cred.failedLoginAttempts + 1;
    const update: Partial<typeof authCredentials.$inferInsert> = {
      failedLoginAttempts: nextCount,
    };
    if (nextCount >= FAILED_ATTEMPTS_BEFORE_DB_LOCKOUT) {
      update.lockedUntil = new Date(Date.now() + DB_LOCKOUT_DURATION_MS);
    }
    await db.update(authCredentials).set(update).where(eq(authCredentials.id, cred.id));
    return { ok: false, code: 'AUTH_INVALID_CREDENTIALS' };
  }

  // (6) 2FA check.
  if (ROLES_REQUIRING_2FA.has(person.role)) {
    if (!cred.totpSecret) {
      // SRS AC-001.4 — force enrolment on next login. Issue a short-lived token
      // that proves the user passed password verification; the enrollment flow
      // exchanges it for a real session after the user confirms their first code.
      const enrollmentToken = await signEnrollmentStep1Jwt(person.id);
      return { ok: false, code: 'AUTH_2FA_NOT_ENROLLED', enrollmentToken };
    }
    if (!input.totpCode) {
      return { ok: false, code: 'AUTH_2FA_REQUIRED' };
    }
    // NOTE: cred.totpSecret is currently stored as plaintext per Phase 2 deferral
    // of column encryption. Once extras/05_*.sql converts the column to bytea, this
    // becomes: app_decrypt(cred.totp_secret_enc) — fetched via a custom SELECT.
    const totpOk = verifyTotp(cred.totpSecret, input.totpCode);
    if (!totpOk) {
      await recordAuthFailure(input.phoneOrEmail);
      return { ok: false, code: 'AUTH_2FA_INVALID' };
    }
  }

  // (7) Success — clear failure state, create session, touch lastActiveAt.
  await resetAuthAttempts(input.phoneOrEmail);
  await db
    .update(authCredentials)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(authCredentials.id, cred.id));

  const ttl = input.client === 'web' ? SESSION_TTL_WEB_SECONDS : SESSION_TTL_MOBILE_SECONDS;
  const session = await createSession({
    personId: person.id,
    role: person.role,
    wardId: person.wardId,
    deviceFingerprint: input.deviceFingerprint,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    ttlSeconds: ttl,
  });

  await db
    .update(people)
    .set({ lastActiveAt: new Date() })
    .where(eq(people.id, person.id));

  return {
    ok: true,
    session,
    person: { id: person.id, role: person.role, wardId: person.wardId },
  };
}
