import { authCredentials, db } from '@an/db';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { verifyTotp } from './totp';

// TOTP enrollment flow (SRS FR-001 AC-001.4).
//
// Two short-lived JWTs carry state across the enrollment steps. They use the same
// JWT_SECRET as session JWTs but carry a distinct `purpose` claim so they cannot be
// substituted for a session token (and vice versa).
//
//   step1: { sub, purpose: 'enroll_step1', exp: +5min }
//     issued by login() on AUTH_2FA_NOT_ENROLLED. Proves the user passed password.
//   step2: { sub, secret, purpose: 'enroll_step2', exp: +5min }
//     issued by /enroll-totp page after generating the candidate secret. The secret
//     is the same value the user just scanned in the QR — no additional exposure.
//
// On step2 confirmation, finalizeEnrollment() saves the secret to authCredentials
// and the caller can then create a real session via createSession().

const ENROLLMENT_TTL_SECONDS = 5 * 60;

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET must be set and ≥ 32 characters');
  }
  return new TextEncoder().encode(s);
}

export interface EnrollmentStep1Claims {
  sub: string;
}

export interface EnrollmentStep2Claims {
  sub: string;
  secret: string;
}

export async function signEnrollmentStep1Jwt(personId: string): Promise<string> {
  return new SignJWT({ purpose: 'enroll_step1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(personId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ENROLLMENT_TTL_SECONDS)
    .sign(getSecret());
}

export async function verifyEnrollmentStep1Jwt(token: string): Promise<EnrollmentStep1Claims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== 'enroll_step1') return null;
    if (typeof payload.sub !== 'string') return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export async function signEnrollmentStep2Jwt(personId: string, secret: string): Promise<string> {
  return new SignJWT({ purpose: 'enroll_step2', secret })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(personId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ENROLLMENT_TTL_SECONDS)
    .sign(getSecret());
}

export async function verifyEnrollmentStep2Jwt(token: string): Promise<EnrollmentStep2Claims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== 'enroll_step2') return null;
    if (typeof payload.sub !== 'string' || typeof payload.secret !== 'string') return null;
    return { sub: payload.sub, secret: payload.secret };
  } catch {
    return null;
  }
}

/**
 * Verify the candidate TOTP code against the secret, then persist the secret onto the
 * person's auth_credentials row.
 *
 * NOTE: stores secret as plaintext today; will switch to app_encrypt(secret) once the
 * production column-encryption migration lands (see extras/04 header).
 */
export async function finalizeEnrollment(
  personId: string,
  secret: string,
  firstCode: string,
): Promise<{ ok: true } | { ok: false; reason: 'invalid_code' | 'no_credentials_row' }> {
  if (!verifyTotp(secret, firstCode)) {
    return { ok: false, reason: 'invalid_code' };
  }
  const updated = await db
    .update(authCredentials)
    .set({ totpSecret: secret, totpEnrolledAt: new Date() })
    .where(eq(authCredentials.personId, personId))
    .returning({ id: authCredentials.id });

  if (updated.length === 0) {
    return { ok: false, reason: 'no_credentials_row' };
  }
  return { ok: true };
}
