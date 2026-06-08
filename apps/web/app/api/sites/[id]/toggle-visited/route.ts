import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auditLog, communitySites } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/sites/[id]/toggle-visited
//
// Form fields:
//   visitNote — optional. When transitioning to visited, this is the ~100-word
//                coordinator note. Capped at 600 chars (≈100 words). When
//                transitioning to NOT visited, the note is cleared.
//
// Audit-logged with the new visited state + truncated note preview.

const NOTE_MAX_CHARS = 600;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  const siteId = params.id;
  const form = await req.formData();
  const rawNote = String(form.get('visitNote') ?? '').trim().slice(0, NOTE_MAX_CHARS);

  await withRlsTx(claims, async (tx) => {
    const rows = await tx
      .select({ visited: communitySites.visited, visitNotes: communitySites.visitNotes })
      .from(communitySites)
      .where(eq(communitySites.id, siteId))
      .limit(1);

    if (rows.length === 0) {
      return;
    }
    const next = !rows[0]!.visited;

    await tx
      .update(communitySites)
      .set({
        visited: next,
        visitedAt: next ? new Date() : null,
        visitedByPersonId: next ? claims.sub : null,
        // On mark-visited: use note if provided, else keep existing.
        // On unmark: clear the note (legacy notes preserved in audit log).
        visitNotes: next
          ? (rawNote || rows[0]!.visitNotes || null)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(communitySites.id, siteId));

    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: next ? 'MARK_SITE_VISITED' : 'UNMARK_SITE_VISITED',
      entityType: 'community_site',
      entityId: siteId,
      beforeValue: { visited: !next, visit_notes: rows[0]!.visitNotes ?? null },
      afterValue:  { visited: next,  visit_notes: next ? (rawNote || rows[0]!.visitNotes) : null },
      context: { source: 'ward_detail_ui' },
    });
  });

  const referer = req.headers.get('referer');
  return NextResponse.redirect(referer ?? new URL('/wards', req.url));
}
