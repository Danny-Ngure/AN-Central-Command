import { NextRequest, NextResponse } from 'next/server';
import { isSessionRevokedOrInvalid, verifySessionJwt, type SessionClaims } from '@an/auth';
import { db, setRequestContext } from '@an/db';

// Shared API utilities for Next.js route handlers.
// All API endpoints in apps/web/app/api/** return the SRS §5.3 response envelope:
//   { success: true, data: T }   OR   { success: false, error: { code, message } }
// Datetimes are ISO 8601 UTC. Pagination is cursor-based (introduced when endpoints
// that paginate land).

// Route handlers using @an/auth / @an/db MUST set `export const runtime = 'nodejs'`
// at the top of their file. Next.js parses that export statically and will not
// follow re-exports through this module.

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<SuccessEnvelope<T>> {
  return NextResponse.json({ success: true, data }, init);
}

export function err(
  code: string,
  message: string,
  status = 400,
  headers?: Record<string, string>,
): NextResponse<ErrorEnvelope> {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers },
  );
}

const SESSION_COOKIE = 'session';

export function extractToken(req: NextRequest): string | null {
  // Mobile: Authorization: Bearer <jwt>
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  // Web: httpOnly cookie set on login.
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export interface RequestContext {
  claims: SessionClaims;
}

/**
 * Wrap a route handler with authentication.
 *
 * Verifies the JWT, checks session revocation, and provides the claims to the handler.
 * On failure, returns the appropriate error envelope per SRS FR-001 ERR-001.*.
 */
export function withAuth<T>(
  handler: (req: NextRequest, ctx: RequestContext) => Promise<NextResponse<SuccessEnvelope<T> | ErrorEnvelope>>,
) {
  return async (req: NextRequest) => {
    const token = extractToken(req);
    if (!token) {
      return err('AUTH_REQUIRED', 'Authentication required', 401);
    }
    const claims = await verifySessionJwt(token);
    if (!claims) {
      return err('AUTH_SESSION_EXPIRED', 'Session is invalid or has expired', 401);
    }
    if (await isSessionRevokedOrInvalid(claims.sid)) {
      return err('AUTH_SESSION_REVOKED', 'Session has been revoked', 401);
    }
    return handler(req, { claims });
  };
}

/**
 * Run a database transaction with RLS context derived from JWT claims.
 *
 * The application connects as a superuser but each transaction drops into the
 * app_user role and sets the session vars that RLS policies read. See
 * packages/db/src/client.ts setRequestContext() and packages/db/extras/03_rls_policies.sql.
 */
export async function withRlsTx<T>(
  claims: SessionClaims,
  work: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setRequestContext(tx, {
      role: claims.role,
      wardId: claims.wardId,
      personId: claims.sub,
    });
    return work(tx);
  });
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
