import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// JWT session tokens.
//
// Claims carry exactly what the API and the database RLS policies need to decide
// authorization. The DB never queries auth_credentials again after the initial login.
// The session table is consulted for revocation (FR-003), not for authorization.

const ALG = 'HS256';

export interface SessionClaims extends JWTPayload {
  /** Standard `sub` claim — the person UUID. Maps to app.person_id RLS session var. */
  sub: string;
  /** CampaignRole — maps to app.role RLS session var. */
  role: string;
  /** Optional ward UUID for ward-scoped roles. Maps to app.ward_id. */
  wardId?: string;
  /** Server-side session row UUID — used to check revocation on every request. */
  sid: string;
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET must be set and ≥ 32 characters');
  }
  return new TextEncoder().encode(s);
}

function getIssuer(): string {
  return process.env.JWT_ISSUER ?? 'an-central-command';
}

/**
 * Sign a session JWT with the given claims and TTL.
 *
 * @param claims Subject, role, wardId, sessionId.
 * @param ttlSeconds Token lifetime. BR-001.3: 24h web (86400), 7d mobile (604800).
 */
export async function signSessionJwt(
  claims: SessionClaims,
  ttlSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setIssuer(getIssuer())
    .setExpirationTime(now + ttlSeconds)
    .sign(getSecret());
}

/**
 * Verify a token's signature and standard claims. Returns the claims on success or
 * null on any failure (invalid signature, expired, malformed, wrong issuer).
 *
 * Does NOT check session revocation — callers must look up the session row themselves
 * using `claims.sid`. Splitting these concerns lets verifySessionJwt() be synchronous
 * and stateless when called from edge functions / middleware.
 */
export async function verifySessionJwt(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: getIssuer(),
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || typeof payload.role !== 'string') {
      return null;
    }
    return payload as SessionClaims;
  } catch {
    return null;
  }
}
