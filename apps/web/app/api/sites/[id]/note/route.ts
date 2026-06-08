import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auditLog, communitySites } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/sites/[id]/visit
//
// Three structured coordinator workflows live behind this one endpoint:
//
//   action='plan'
//     plannedVisitAt + plannedPurpose + plannedObjectives [+ plannedAttendees]
//     → records an upcoming visit; site stays un-visited
//
//   action='log'
//     visitedAt + visitNote + visitPromises + visitBenefits + visitResponse +
//     visitTemperature + visitRecommendation + visitEffort
//     → flips the site to visited with the full assessment captured
//
//   action='edit'  (same fields as 'log', applied to an already-visited site)
//
// Server-side validation enforces required fields per action; failing validation
// redirects back with ?siteError=... so the form can flag missing inputs.

const NOTE_MAX_CHARS = 600;
const FREE_TEXT_MAX = 800;

const TEMPERATURES = ['hot', 'warm', 'cold'] as const;
const RECOMMENDATIONS = ['high_priority', 'normal', 'low_priority'] as const;
const EFFORT_LEVELS = ['intensify', 'maintain', 'reduce'] as const;

type Temperature = (typeof TEMPERATURES)[number];
type Recommendation = (typeof RECOMMENDATIONS)[number];
type EffortLevel = (typeof EFFORT_LEVELS)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  const siteId = params.id;
  const form = await req.formData();
  const action = String(form.get('action') ?? '').trim() || 'edit';

  const visitNote        = clamp(String(form.get('visitNote') ?? '').trim(), NOTE_MAX_CHARS);
  const visitPromises    = clamp(String(form.get('visitPromises') ?? '').trim(), FREE_TEXT_MAX);
  const visitBenefits    = clamp(String(form.get('visitBenefits') ?? '').trim(), FREE_TEXT_MAX);
  const visitResponse    = clamp(String(form.get('visitResponse') ?? '').trim(), FREE_TEXT_MAX);
  const visitTemperature = enumIn(String(form.get('visitTemperature') ?? ''), TEMPERATURES);
  const visitRecommendation = enumIn(String(form.get('visitRecommendation') ?? ''), RECOMMENDATIONS);
  const visitEffort      = enumIn(String(form.get('visitEffort') ?? ''), EFFORT_LEVELS);
  const visitedAt        = parseDate(String(form.get('visitedAt') ?? ''));

  const plannedVisitAt   = parseDate(String(form.get('plannedVisitAt') ?? ''));
  const plannedPurpose   = clamp(String(form.get('plannedPurpose') ?? '').trim(), FREE_TEXT_MAX);
  const plannedObjectives= clamp(String(form.get('plannedObjectives') ?? '').trim(), FREE_TEXT_MAX);
  const plannedAttendees = clamp(String(form.get('plannedAttendees') ?? '').trim(), FREE_TEXT_MAX);

  // ── Validation ───────────────────────────────────────────────────────────
  const errors: string[] = [];

  if (action === 'plan') {
    if (!plannedVisitAt)             errors.push('Planned visit date is required');
    if (!plannedPurpose)             errors.push('Purpose of visit is required');
    if (!plannedObjectives)          errors.push('Objectives are required');
  } else if (action === 'log' || action === 'edit') {
    if (action === 'log' && !visitedAt) errors.push('Visit date is required');
    if (!visitNote)                  errors.push('Nature of interaction is required');
    if (!visitPromises)              errors.push('Promises made is required');
    if (!visitResponse)              errors.push('Response received is required');
    if (!visitTemperature)           errors.push('Welcome temperature is required');
    if (!visitRecommendation)        errors.push('Revisit recommendation is required');
    if (!visitEffort)                errors.push('Effort level is required');
  }

  if (errors.length > 0) {
    const referer = req.headers.get('referer') ?? new URL('/wards', req.url).toString();
    const url = new URL(referer);
    url.searchParams.set('siteError', encodeURIComponent(errors.join(' · ')));
    url.searchParams.set('siteErrorId', siteId);
    return NextResponse.redirect(url);
  }

  // ── Mutation ─────────────────────────────────────────────────────────────
  await withRlsTx(claims, async (tx) => {
    const rows = await tx
      .select({
        visited: communitySites.visited,
        visitNotes: communitySites.visitNotes,
        visitedAt: communitySites.visitedAt,
        plannedVisitAt: communitySites.plannedVisitAt,
      })
      .from(communitySites)
      .where(eq(communitySites.id, siteId))
      .limit(1);
    if (rows.length === 0) return;
    const before = rows[0]!;

    if (action === 'plan') {
      await tx
        .update(communitySites)
        .set({
          plannedVisitAt,
          plannedPurpose,
          plannedObjectives,
          plannedAttendees: plannedAttendees || null,
          updatedAt: new Date(),
        })
        .where(eq(communitySites.id, siteId));
    } else {
      // log or edit — fully populate the visited record.
      await tx
        .update(communitySites)
        .set({
          visited: true,
          visitedAt: visitedAt ?? before.visitedAt ?? new Date(),
          visitedByPersonId: before.visited ? undefined : claims.sub,
          visitNotes: visitNote,
          visitPromises,
          visitBenefits: visitBenefits || null,
          visitResponse,
          visitTemperature,
          visitRecommendation,
          visitEffort,
          plannedVisitAt: null,            // clear any prior plan
          plannedPurpose: null,
          plannedObjectives: null,
          plannedAttendees: null,
          updatedAt: new Date(),
        })
        .where(eq(communitySites.id, siteId));
    }

    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: action === 'plan' ? 'PLAN_SITE_VISIT' : action === 'log' ? 'LOG_SITE_VISIT' : 'EDIT_SITE_VISIT',
      entityType: 'community_site',
      entityId: siteId,
      beforeValue: {
        visited: before.visited,
        visit_notes: before.visitNotes ?? null,
        visited_at: before.visitedAt,
        planned_visit_at: before.plannedVisitAt,
      },
      afterValue: action === 'plan'
        ? { plannedVisitAt, plannedPurpose, plannedObjectives, plannedAttendees }
        : {
            visited: true,
            visit_notes: visitNote,
            visited_at: visitedAt ?? new Date(),
            visit_promises: visitPromises,
            visit_benefits: visitBenefits || null,
            visit_response: visitResponse,
            visit_temperature: visitTemperature,
            visit_recommendation: visitRecommendation,
            visit_effort: visitEffort,
          },
      context: { source: 'ward_detail_ui' },
    });
  });

  const referer = req.headers.get('referer');
  return NextResponse.redirect(referer ?? new URL('/wards', req.url));
}

// ── helpers ─────────────────────────────────────────────────────────────────

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}
function enumIn<T extends readonly string[]>(s: string, options: T): T[number] | null {
  return (options as readonly string[]).includes(s) ? (s as T[number]) : null;
}
function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
