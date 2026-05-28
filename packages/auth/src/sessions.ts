import { randomUUID } from 'node:crypto';
import { db, sessions } from '@an/db';
import { eq } from 'drizzle-orm';
import { signSessionJwt, type SessionClaims } from './jwt';

// Session lifecycle (SRS FR-001 POST-001.1, FR-003).
//
// On successful login we:
//   1. Generate a server-side session UUID (sid).
//   2. Sign a JWT containing the sid (so revocation works without re-signing tokens).
//   3. Insert the sessions row with the JWT as the canonical token reference,
//      device fingerprint, IP, and TTL.
//
// On every subsequent request:
//   1. Verify the JWT signature + expiry via verifySessionJwt (in jwt.ts).
//   2. Look up sessions row by sid; reject if revoked_at IS NOT NULL.
//
// An admin can revoke any session by setting revoked_at. The token continues to
// validate cryptographically but isRevoked() returns true → API rejects (FR-003).

export interface SessionTokens {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export interface CreateSessionInput {
  personId: string;
  role: string;
  wardId?: string | null;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  ttlSeconds: number;
}

export async function createSession(input: CreateSessionInput): Promise<SessionTokens> {
  const sessionId = randomUUID();
  const claims: SessionClaims = {
    sub: input.personId,
    role: input.role,
    sid: sessionId,
  };
  if (input.wardId) claims.wardId = input.wardId;

  const token = await signSessionJwt(claims, input.ttlSeconds);
  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    personId: input.personId,
    token,
    deviceFingerprint: input.deviceFingerprint,
    ipAddress: input.ipAddress as any,
    userAgent: input.userAgent,
    expiresAt,
  });

  return { token, sessionId, expiresAt };
}

/** FR-003: admin revokes a session. Subsequent verifySession() calls reject within 60s. */
export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(eq(sessions.id, sessionId));
}

/** Returns true if the session row is missing, revoked, or expired. */
export async function isSessionRevokedOrInvalid(sessionId: string): Promise<boolean> {
  const rows = await db
    .select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (rows.length === 0) return true;
  const { revokedAt, expiresAt } = rows[0];
  if (revokedAt) return true;
  if (expiresAt && expiresAt.getTime() < Date.now()) return true;
  return false;
}

/** Update the lastUsedAt timestamp on the session row. Call on each authenticated request. */
export async function touchSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}
