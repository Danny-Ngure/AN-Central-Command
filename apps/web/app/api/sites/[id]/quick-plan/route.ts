import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auditLog, communitySites } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/sites/[id]/quick-plan
//
// The one-tap counterpart to /api/sites/[id]/note (action='plan'). The "Plan my
// month" itinerary builder (/meetings?action=plan) needs the lightest possible
// gesture: pick a date → add to plan. So this endpoint requires ONLY a date
// (purpose is optional, no objectives/attendees). The full structured plan form
// still lives on the ward page for when a coordinator wants to capture detail.
//
//   plannedVisitAt = YYYY-MM-DD   → sets the planned visit
//   clear=1                       → removes the plan
//
// Always redirects back to the `redirect` form field (falling back to referer),
// so the itinerary page can re-render with the ward section the user was in.

const FREE_TEXT_MAX = 800;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  const siteId = params.id;
  const form = await req.formData();
  const clear = String(form.get('clear') ?? '') === '1';
  const plannedVisitAt = parseDate(String(form.get('plannedVisitAt') ?? ''));
  const plannedPurpose = clamp(String(form.get('plannedPurpose') ?? '').trim(), FREE_TEXT_MAX);

  const redirectTo = String(form.get('redirect') ?? '').trim();
  const back = () => {
    const target = redirectTo || req.headers.get('referer') || '/meetings?action=plan';
    return NextResponse.redirect(new URL(target, req.url));
  };

  if (!clear && !plannedVisitAt) {
    const target = redirectTo || req.headers.get('referer') || '/meetings?action=plan';
    const url = new URL(target, req.url);
    url.searchParams.set('planError', 'Pick a date to add this place to the plan.');
    return NextResponse.redirect(url);
  }

  await withRlsTx(claims, async (tx) => {
    const rows = await tx
      .select({
        plannedVisitAt: communitySites.plannedVisitAt,
        plannedPurpose: communitySites.plannedPurpose,
        visited: communitySites.visited,
      })
      .from(communitySites)
      .where(eq(communitySites.id, siteId))
      .limit(1);
    if (rows.length === 0) return;
    const before = rows[0]!;

    await tx
      .update(communitySites)
      .set(
        clear
          ? { plannedVisitAt: null, plannedPurpose: null, plannedObjectives: null, plannedAttendees: null, updatedAt: new Date() }
          : { plannedVisitAt, plannedPurpose: plannedPurpose || before.plannedPurpose || null, updatedAt: new Date() },
      )
      .where(eq(communitySites.id, siteId));

    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: clear ? 'CLEAR_SITE_PLAN' : 'PLAN_SITE_VISIT',
      entityType: 'community_site',
      entityId: siteId,
      beforeValue: { planned_visit_at: before.plannedVisitAt, planned_purpose: before.plannedPurpose },
      afterValue: clear ? { planned_visit_at: null } : { planned_visit_at: plannedVisitAt, planned_purpose: plannedPurpose || before.plannedPurpose || null },
      context: { source: 'itinerary_quick_plan' },
    });
  });

  return back();
}

// ── helpers ─────────────────────────────────────────────────────────────────

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}
function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
