import { NextRequest } from 'next/server';
import { randomInt } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '@an/auth';
import { authCredentials, auditLog, db, people } from '@an/db';
import { getServerAuth } from '@/lib/server-auth';
import { err, ok } from '@/lib/api';
import { isSuperAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

// POST /api/team/[id]/reset-password
//
// SUPER ADMIN (Dan) ONLY. Resets a team member's password to a fresh temporary one
// (for the "I forgot my password" case), forces them to change it on next login, and
// clears any TOTP / lockout / failure state. Returns the temporary password so Dan can
// pass it to the person. Every reset is written to the audit log (which only Dan sees).

function tempPassword(): string {
  // Readable, ≥12 chars, satisfies the 12-char minimum in hashPassword().
  return `AN-Reset-${randomInt(100000, 1000000)}`; // e.g. AN-Reset-482913 (15 chars)
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const claims = await getServerAuth();
  if (!claims) return err('AUTH_REQUIRED', 'Authentication required', 401);
  if (!(await isSuperAdmin(claims.sub))) {
    return err('AUTHZ_SUPER_ONLY', 'Only the Super Admin (Dan) can reset passwords.', 403);
  }

  const target = await db
    .select({ id: people.id, fullName: people.fullName })
    .from(people)
    .where(eq(people.id, params.id))
    .limit(1);
  if (target.length === 0) return err('PERSON_NOT_FOUND', 'That person does not exist', 404);
  const person = target[0]!;

  const temp = tempPassword();
  const hashed = await hashPassword(temp);

  // Upsert the credential — overwrite if present, create if the person had none.
  const existing = await db
    .select({ id: authCredentials.id })
    .from(authCredentials)
    .where(eq(authCredentials.personId, person.id))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(authCredentials)
      .set({
        passwordHash: hashed,
        mustChangePassword: true,
        totpSecret: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(authCredentials.personId, person.id));
  } else {
    await db.insert(authCredentials).values({
      personId: person.id,
      passwordHash: hashed,
      mustChangePassword: true,
    });
  }

  // Keep the super-admin recovery copy (encrypted) in sync so Dan's credentials page
  // shows the new temporary password.
  const key = process.env.PGCRYPTO_KEY;
  if (key) {
    await db.execute(
      sql`UPDATE auth_credentials SET password_recovery_enc = pgp_sym_encrypt(${temp}, ${key}) WHERE person_id = ${person.id}`,
    );
  }

  await db.insert(auditLog).values({
    actorPersonId: claims.sub,
    actorRole: claims.role,
    action: 'ADMIN_RESET_PASSWORD',
    entityType: 'person',
    entityId: person.id,
    afterValue: { target: person.fullName, forcedChange: true },
    context: { source: 'admin_reset_ui' },
  });

  return ok({ name: person.fullName, tempPassword: temp });
}
