import { authCredentials, db } from '@an/db';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './passwords';

// Change-password flow (SRS FR-001, BR-001.1).
//
// A signed-in user swaps their password: we verify the CURRENT password, enforce the
// new-password policy (≥12 chars, must differ), then store the new Argon2id hash and
// stamp password_changed_at. On success we also clear any lockout/failed-attempt
// state so a fresh password starts clean.
//
// This is the path users take off the default password (their National ID), which is
// intentionally below the 12-char minimum — so their NEW password must meet BR-001.1.

const MIN_LENGTH = 12;

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: 'NO_CREDENTIALS' | 'WRONG_CURRENT' | 'WEAK_NEW' | 'SAME_AS_OLD' };

export async function changePassword(
  personId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const rows = await db
    .select({ id: authCredentials.id, passwordHash: authCredentials.passwordHash })
    .from(authCredentials)
    .where(eq(authCredentials.personId, personId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'NO_CREDENTIALS' };
  const cred = rows[0]!;

  // Verify the current password first — never reveal policy details before this.
  const currentOk = await verifyPassword(currentPassword, cred.passwordHash);
  if (!currentOk) return { ok: false, error: 'WRONG_CURRENT' };

  if (!newPassword || newPassword.length < MIN_LENGTH) return { ok: false, error: 'WEAK_NEW' };
  if (newPassword === currentPassword) return { ok: false, error: 'SAME_AS_OLD' };

  const newHash = await hashPassword(newPassword); // re-enforces the 12-char minimum
  await db
    .update(authCredentials)
    .set({
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      mustChangePassword: false,
    })
    .where(eq(authCredentials.id, cred.id));

  return { ok: true };
}
