import { NextResponse, type NextRequest } from 'next/server';

// Exposes the current pathname to server components (layouts can't read it directly)
// via an `x-pathname` request header. The (authed) layout uses it to hard-gate users
// who still have their default password onto /account/password.

export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Everything except Next internals, static assets, and API routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
