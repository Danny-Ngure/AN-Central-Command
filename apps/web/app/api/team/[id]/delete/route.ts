import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { auditLog, db, people } from '@an/db';
import { getServerAuth } from '@/lib/server-auth';
import { err, ok } from '@/lib/api';
import { isSuperAdmin, SUPER_ADMIN_NAME } from '@/lib/admin';

export const runtime = 'nodejs';

// POST /api/team/[id]/delete
//
// SUPER ADMIN (Dan) ONLY. Soft-deletes a team member: sets active = false and stamps
// deleted_at, so they can no longer sign in or appear in the directory, while their
// history (audit trail, past visits) is preserved and the account can be restored.
// Guards: Dan cannot delete himself or the super-admin identity.

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const claims = await getServerAuth();
  if (!claims) return err('AUTH_REQUIRED', 'Authentication required', 401);
  if (!(await isSuperAdmin(claims.sub))) {
    return err('AUTHZ_SUPER_ONLY', 'Only the Super Admin (Dan) can delete users.', 403);
  }

  const target = await db
    .select({ id: people.id, fullName: people.fullName })
    .from(people)
    .where(eq(people.id, params.id))
    .limit(1);
  if (target.length === 0) return err('PERSON_NOT_FOUND', 'That person does not exist', 404);
  const person = target[0]!;

  if (person.id === claims.sub || person.fullName === SUPER_ADMIN_NAME) {
    return err('DELETE_SELF_FORBIDDEN', 'You cannot delete the super-admin account.', 400);
  }

  await db
    .update(people)
    .set({ active: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(people.id, person.id));

  await db.insert(auditLog).values({
    actorPersonId: claims.sub,
    actorRole: claims.role,
    action: 'DELETE_USER',
    entityType: 'person',
    entityId: person.id,
    afterValue: { target: person.fullName, softDeleted: true },
    context: { source: 'admin_delete_ui' },
  });

  return ok({ id: person.id, name: person.fullName });
}
