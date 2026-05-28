import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  createSession,
  finalizeEnrollment,
  verifyEnrollmentStep2Jwt,
} from '@an/auth';
import { db, people } from '@an/db';
import { err, ok, SESSION_COOKIE_NAME } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/auth/enroll-totp/confirm
//
// Body: { token: <enrollmentStep2Jwt>, code: <6-digit> }
//
// Verifies the enrollment token, validates the code against the secret embedded in it,
// persists the secret to authCredentials, then creates a real session.
// Sets the session cookie on success — user lands logged in.

interface Body {
  token?: string;
  code?: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err('AUTH_BAD_REQUEST', 'Request body must be JSON', 400);
  }
  if (!body.token || !body.code) {
    return err('AUTH_BAD_REQUEST', 'token and code are required', 400);
  }

  const claims = await verifyEnrollmentStep2Jwt(body.token);
  if (!claims) {
    return err('AUTH_ENROLLMENT_EXPIRED', 'Enrollment session has expired — sign in again', 401);
  }

  const result = await finalizeEnrollment(claims.sub, claims.secret, body.code);
  if (!result.ok) {
    if (result.reason === 'invalid_code') {
      return err('AUTH_2FA_INVALID', 'Code is incorrect — try again', 401);
    }
    return err('AUTH_ENROLLMENT_FAILED', 'Could not save credentials', 500);
  }

  // Persist enrollment succeeded — create a real session.
  const personRows = await db
    .select({
      id: people.id,
      fullName: people.fullName,
      role: people.role,
      wardId: people.wardId,
    })
    .from(people)
    .where(eq(people.id, claims.sub))
    .limit(1);
  if (personRows.length === 0) {
    return err('AUTH_ENROLLMENT_FAILED', 'Account not found', 500);
  }
  const person = personRows[0];

  const session = await createSession({
    personId: person.id,
    role: person.role,
    wardId: person.wardId,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ttlSeconds: 24 * 60 * 60, // web session
  });

  await db
    .update(people)
    .set({ lastActiveAt: new Date() })
    .where(eq(people.id, person.id));

  const response = ok({
    person: { id: person.id, fullName: person.fullName, role: person.role, wardId: person.wardId },
    expiresAt: session.expiresAt.toISOString(),
  });
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: session.expiresAt,
    path: '/',
  });
  return response;
}
