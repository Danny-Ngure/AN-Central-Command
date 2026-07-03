import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { auditLog, db, people, wards } from '@an/db';
import { getServerAuth } from '@/lib/server-auth';
import { err, ok } from '@/lib/api';
import { isSuperAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

// POST /api/team/[id]/role  { role, wardId? }
//
// SUPER ADMIN (Dan) ONLY — changing someone's role is a power grant, reserved for the
// super admin. Sets people.role (and ward, when the new role is ward-scoped). The new
// role takes effect on the person's NEXT sign-in (their current session keeps its old
// role until the JWT is reissued). Audited as CHANGE_ROLE.

const VALID_ROLES = new Set([
  'candidate', 'campaign_manager', 'chief_strategist', 'constituency_coordinator',
  'media_head', 'comms_head', 'patron_ceo', 'ward_coordinator', 'assistant_ward_coordinator',
  'polling_station_lead', 'polling_agent', 'canvasser', 'influence_liaison', 'tech_lead', 'finance_lead',
]);
const WARD_SCOPED = new Set(['ward_coordinator', 'assistant_ward_coordinator', 'polling_station_lead', 'polling_agent']);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const claims = await getServerAuth();
  if (!claims) return err('AUTH_REQUIRED', 'Authentication required', 401);
  if (!(await isSuperAdmin(claims.sub))) {
    return err('AUTHZ_SUPER_ONLY', 'Only the Super Admin (Dan) can change a user’s role.', 403);
  }

  let body: { role?: string; wardId?: string | null };
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Body must be JSON', 400);
  }
  const role = (body.role ?? '').trim();
  if (!VALID_ROLES.has(role)) return err('ROLE_INVALID', 'Pick a valid role', 400);

  const target = await db
    .select({ id: people.id, fullName: people.fullName, role: people.role, wardId: people.wardId })
    .from(people)
    .where(eq(people.id, params.id))
    .limit(1);
  if (target.length === 0) return err('PERSON_NOT_FOUND', 'That person does not exist', 404);
  const person = target[0]!;

  // Decide the ward: ward-scoped roles need one; others become constituency-wide.
  let wardId: string | null = person.wardId;
  if (WARD_SCOPED.has(role)) {
    const requested = (body.wardId ?? person.wardId ?? '').toString().trim();
    if (!requested) return err('ROLE_WARD_REQUIRED', 'A ward is required for a ward-scoped role', 400);
    const w = await db.select({ id: wards.id }).from(wards).where(eq(wards.id, requested)).limit(1);
    if (w.length === 0) return err('ROLE_WARD_UNKNOWN', 'That ward does not exist', 400);
    wardId = requested;
  } else {
    wardId = null; // constituency-wide
  }

  await db.update(people).set({ role: role as any, wardId, updatedAt: new Date() }).where(eq(people.id, person.id));

  await db.insert(auditLog).values({
    actorPersonId: claims.sub,
    actorRole: claims.role,
    action: 'CHANGE_ROLE',
    entityType: 'person',
    entityId: person.id,
    beforeValue: { role: person.role, wardId: person.wardId },
    afterValue: { target: person.fullName, role, wardId },
    context: { source: 'admin_role_ui' },
  });

  return ok({ id: person.id, name: person.fullName, role, wardId });
}
