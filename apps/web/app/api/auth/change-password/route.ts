import { changePassword } from '@an/auth';
import { err, ok, withAuth } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/auth/change-password
//
// Body: { currentPassword: string, newPassword: string }
// The signed-in user changes their own password. The person is taken from the JWT
// (claims.sub) — a user can never change someone else's password here.

export const POST = withAuth(async (req, { claims }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Invalid JSON body', 400);
  }
  const currentPassword = String((body as any)?.currentPassword ?? '');
  const newPassword = String((body as any)?.newPassword ?? '');
  if (!currentPassword || !newPassword) {
    return err('BAD_REQUEST', 'currentPassword and newPassword are required', 400);
  }

  const result = await changePassword(claims.sub, currentPassword, newPassword);
  if (!result.ok) {
    const MAP: Record<string, [number, string]> = {
      WRONG_CURRENT: [401, 'Your current password is incorrect.'],
      WEAK_NEW: [400, 'New password must be at least 12 characters.'],
      SAME_AS_OLD: [400, 'New password must be different from your current one.'],
      NO_CREDENTIALS: [404, 'No login credentials found for this account.'],
    };
    const [status, message] = MAP[result.error] ?? [400, 'Could not change password.'];
    return err(result.error, message, status);
  }

  return ok({ changed: true });
});
