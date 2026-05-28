import { NextRequest, NextResponse } from 'next/server';
import { login } from '@an/auth';
import { err, ok, SESSION_COOKIE_NAME } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/auth/login
//
// Web body:    { phoneOrEmail, password, totpCode?, client: 'web' }
// Mobile body: { phoneOrEmail, password, totpCode?, client: 'mobile' }
//
// On success:
//   - Web   → httpOnly session cookie set; response body has { person, expiresAt }
//   - Mobile → response body has { token, person, expiresAt }
//
// On failure: SRS FR-001 ERR-001.* mapped to HTTP status codes.

interface LoginBody {
  phoneOrEmail?: string;
  password?: string;
  totpCode?: string;
  client?: 'web' | 'mobile';
}

export async function POST(req: NextRequest) {
  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return err('AUTH_BAD_REQUEST', 'Request body must be JSON', 400);
  }

  if (!body.phoneOrEmail || !body.password) {
    return err('AUTH_BAD_REQUEST', 'phoneOrEmail and password are required', 400);
  }

  const result = await login({
    phoneOrEmail: body.phoneOrEmail,
    password: body.password,
    totpCode: body.totpCode,
    client: body.client === 'mobile' ? 'mobile' : 'web',
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  if (!result.ok) {
    const headers: Record<string, string> = {};
    if (result.retryAfterSeconds) {
      headers['Retry-After'] = String(result.retryAfterSeconds);
    }
    const status =
      result.code === 'AUTH_ACCOUNT_LOCKED' ? 423
      : result.code === 'AUTH_RATE_LIMITED' ? 429
      : 401;

    // AUTH_2FA_NOT_ENROLLED carries an enrollment token in the error details so the
    // client can redirect to /enroll-totp. Other error codes use the plain envelope.
    if (result.code === 'AUTH_2FA_NOT_ENROLLED' && result.enrollmentToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.code,
            message: errorMessage(result.code),
            details: { enrollmentToken: result.enrollmentToken },
          },
        },
        { status, headers },
      );
    }
    return err(result.code, errorMessage(result.code), status, headers);
  }

  const responseBody: Record<string, unknown> = {
    person: result.person,
    expiresAt: result.session.expiresAt.toISOString(),
  };
  // Mobile clients use the token in the response body. Web clients use the cookie.
  if (body.client === 'mobile') {
    responseBody.token = result.session.token;
  }

  const response = ok(responseBody);
  if (body.client !== 'mobile') {
    response.cookies.set(SESSION_COOKIE_NAME, result.session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: result.session.expiresAt,
      path: '/',
    });
  }
  return response;
}

function errorMessage(code: string): string {
  switch (code) {
    case 'AUTH_INVALID_CREDENTIALS': return 'Phone/email or password is incorrect';
    case 'AUTH_ACCOUNT_LOCKED':      return 'Account is locked — try again later';
    case 'AUTH_2FA_REQUIRED':        return 'Two-factor authentication code required';
    case 'AUTH_2FA_NOT_ENROLLED':    return 'Two-factor authentication is required for this role; please enroll';
    case 'AUTH_2FA_INVALID':         return 'Two-factor authentication code is incorrect';
    case 'AUTH_RATE_LIMITED':        return 'Too many attempts — slow down';
    default:                         return 'Authentication failed';
  }
}
