import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auditLog, people } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/team/[id]/village — set (or clear) the village a team member is based in.
// Body: villageId = <uuid> | '' (clear). Plain <form> post; redirects back.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  const form = await req.formData();
  const raw = String(form.get('villageId') ?? '').trim();
  const villageId = /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;

  await withRlsTx(claims, async (tx) => {
    const before = await tx.select({ homeVillageId: people.homeVillageId }).from(people).where(eq(people.id, params.id)).limit(1);
    if (before.length === 0) return;
    await tx.update(people).set({ homeVillageId: villageId, updatedAt: new Date() }).where(eq(people.id, params.id));
    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: 'SET_PERSON_VILLAGE',
      entityType: 'person',
      entityId: params.id,
      beforeValue: { home_village_id: before[0]!.homeVillageId },
      afterValue: { home_village_id: villageId },
      context: { source: 'assign_villages_ui' },
    });
  });

  const back = req.headers.get('referer') ?? new URL('/team/assign-villages', req.url).toString();
  return NextResponse.redirect(back, 303);
}
