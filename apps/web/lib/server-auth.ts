import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSessionRevokedOrInvalid, verifySessionJwt, type SessionClaims } from '@an/auth';
import { SESSION_COOKIE_NAME } from './api';

// Server-component authentication.
//
// Use in (authed) route group layouts and protected page components:
//
//   export default async function DashboardPage() {
//     const claims = await getServerAuthOrRedirect();
//     // ... claims.sub / claims.role / claims.wardId available
//   }
//
// Differs from withAuth() in lib/api.ts — that one is for API route handlers and
// returns NextResponse on failure. This one redirects to /login on failure.

export async function getServerAuthOrRedirect(redirectTo = '/login'): Promise<SessionClaims> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect(redirectTo);
  const claims = await verifySessionJwt(token);
  if (!claims) redirect(redirectTo);
  if (await isSessionRevokedOrInvalid(claims.sid)) redirect(redirectTo);
  return claims;
}

/** Returns claims if authenticated, null otherwise. Does not redirect. */
export async function getServerAuth(): Promise<SessionClaims | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const claims = await verifySessionJwt(token);
  if (!claims) return null;
  if (await isSessionRevokedOrInvalid(claims.sid)) return null;
  return claims;
}
