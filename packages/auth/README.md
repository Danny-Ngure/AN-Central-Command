# @an/auth

Authentication primitives for the AN Central Command platform. Implements SRS **FR-001** (User Authentication), **FR-002** (RBAC — provides the claims; policies live in `@an/db`), **FR-003** (Session Management), and **NFR-013** (Rate Limiting).

Consumed by:
- `apps/web` Next.js API routes (login, refresh, revoke)
- `apps/field` and `apps/nyalitrack` Expo apps via the typed `@an/api-client`

## Modules

| File | Responsibility |
|---|---|
| `passwords.ts` | Argon2id hash + verify (OWASP-recommended params) |
| `totp.ts` | TOTP secret generation, otpauth URL, code verification |
| `jwt.ts` | Sign + verify session JWTs (HS256, jose) |
| `redis.ts` | Lazy-singleton Redis client |
| `rate-limit.ts` | 5/min identifier rate limit + 30-min lockout |
| `sessions.ts` | Session create / revoke / touch — backed by `sessions` table |
| `login.ts` | Orchestrated flow: rate-limit → password → 2FA → session |

## Public API

```ts
import { login, verifySessionJwt, revokeSession } from '@an/auth';

// In a Next.js POST /api/auth/login handler:
const result = await login({
  phoneOrEmail: req.body.phone,
  password: req.body.password,
  totpCode: req.body.totpCode,
  client: 'web',
  ipAddress: req.headers['x-forwarded-for'],
  userAgent: req.headers['user-agent'],
});

if (!result.ok) {
  switch (result.code) {
    case 'AUTH_INVALID_CREDENTIALS': return Response.json({...}, { status: 401 });
    case 'AUTH_ACCOUNT_LOCKED':       return Response.json({...}, { status: 423, headers: { 'Retry-After': String(result.retryAfterSeconds) }});
    case 'AUTH_2FA_REQUIRED':         return Response.json({ code: 'AUTH_2FA_REQUIRED' }, { status: 401 });
    case 'AUTH_2FA_NOT_ENROLLED':     // redirect to enrollment
    case 'AUTH_2FA_INVALID':          return Response.json({...}, { status: 401 });
    case 'AUTH_RATE_LIMITED':         return Response.json({...}, { status: 429 });
  }
}

// success — set session cookie / return JWT to mobile
const { token, sessionId, expiresAt } = result.session;
```

```ts
// On every authenticated request:
import { verifySessionJwt } from '@an/auth';
import { isSessionRevokedOrInvalid } from '@an/auth';

const claims = await verifySessionJwt(token);
if (!claims) return 401;
if (await isSessionRevokedOrInvalid(claims.sid)) return 401;

// Now wire claims into the DB session for RLS:
import { db, setRequestContext } from '@an/db';
await db.transaction(async (tx) => {
  await setRequestContext(tx, { role: claims.role, wardId: claims.wardId, personId: claims.sub });
  // ... queries here run with RLS scoped to this user
});
```

## Environment

See [.env.example](.env.example). Critical:

- `JWT_SECRET` — at least 32 random bytes. Generate with `openssl rand -hex 64`.
- `REDIS_URL` — `redis://localhost:6379` for local dev (matches `infra/docker-compose.yml`).
- `DATABASE_URL` — same value as `@an/db`'s `.env.local`.

## What's deferred to later phases

- **Password reset / recovery flow** — a separate `recoverPassword()` orchestrator, post-MVP.
- **Device-binding refresh tokens** — currently each login creates a session; explicit refresh tokens come in v1.1 with biometric mobile unlock (FR-004).
- **Login-from-new-device WhatsApp/email notification** (AC-001.5) — wired in Phase 7 when `@an/notifications` lands.
- **Backup TOTP codes** — defer until a real user reports they need them.
- **totp_secret column encryption** — currently plaintext per Phase 2 deferral; flip to `app_decrypt(cred.totp_secret_enc)` when production encryption migration lands.
