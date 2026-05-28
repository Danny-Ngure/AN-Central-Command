import { NextRequest } from 'next/server';
import { revokeSession } from '@an/auth';
import { extractToken, ok, SESSION_COOKIE_NAME } from '@/lib/api';
import { verifySessionJwt } from '@an/auth';

export const runtime = 'nodejs';

// POST /api/auth/logout
//
// Revokes the current session and clears the session cookie.
// Safe to call even with an invalid token — returns success either way (idempotent).

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (token) {
    const claims = await verifySessionJwt(token);
    if (claims) {
      await revokeSession(claims.sid, 'user_logout');
    }
  }
  const response = ok({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
  return response;
}
