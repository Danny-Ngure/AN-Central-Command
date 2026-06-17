import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { activities, auditLog, communitySites } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/activities/create  (multipart/form-data or urlencoded)
//
// Easy, flexible activity entry. An activity can be logged:
//   • at a community site   → pass siteId (name + ward denormalised from the site)
//   • at a ward             → pass wardId (+ optional free-text locationName)
//   • constituency-wide     → pass neither (wardId null)
//
// It can be a PLANNED activity (future) or a COMPLETED one logged after the fact
// (status=completed → actualAttendance / candidateAttended / outcomeNotes).
//
// Required: title + type + scheduledAt.
//
// Responds with JSON when the caller sends `Accept: application/json` (the Quick
// Add modal), otherwise redirects (back-compat with the plain meetings-page form).

const TITLE_MAX = 200;
const FREE_TEXT_MAX = 2000;

const ACTIVITY_TYPES = [
  'rally', 'baraza', 'community_meeting', 'town_hall',
  'mosque_visit', 'church_visit', 'madrasa_visit',
  'boda_stage_stop', 'market_visit', 'chama_meeting',
  'door_to_door', 'youth_event', 'women_event',
  'harambee', 'condolence_visit', 'wedding_attendance',
  'courtesy_call', 'media_engagement', 'launch_event',
  'internal_strategy', 'training', 'other',
] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

const STATUSES = ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json');
  const claims = await getServerAuth();
  if (!claims) {
    return wantsJson
      ? NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url));
  }

  const form = await req.formData();
  const siteId = String(form.get('siteId') ?? '').trim();
  const wardIdForm = String(form.get('wardId') ?? '').trim();
  const locationNameForm = clamp(String(form.get('locationName') ?? '').trim(), TITLE_MAX);
  const title = clamp(String(form.get('title') ?? '').trim(), TITLE_MAX);
  const typeRaw = String(form.get('type') ?? '').trim();
  const scheduledAtRaw = String(form.get('scheduledAt') ?? '').trim();
  const notes = clamp(String(form.get('outcomeNotes') ?? form.get('agenda') ?? '').trim(), FREE_TEXT_MAX);
  const statusRaw = String(form.get('status') ?? 'planned').trim();
  const expectedRaw = String(form.get('expectedAttendance') ?? '').trim();
  const actualRaw = String(form.get('actualAttendance') ?? '').trim();
  const candidateAttended = ['on', 'true', '1', 'yes'].includes(String(form.get('candidateAttended') ?? '').toLowerCase());
  const followUpRequired = ['on', 'true', '1', 'yes'].includes(String(form.get('followUpRequired') ?? '').toLowerCase());

  const errors: string[] = [];
  if (!title) errors.push('Title is required');
  if (!scheduledAtRaw) errors.push('Date / time required');
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) errors.push('Date / time invalid');
  const type: ActivityType = ACTIVITY_TYPES.includes(typeRaw as ActivityType) ? (typeRaw as ActivityType) : 'other';
  const status: Status = STATUSES.includes(statusRaw as Status) ? (statusRaw as Status) : 'planned';

  if (errors.length > 0) return fail(req, wantsJson, errors.join('; '));

  const result = await withRlsTx(claims, async (tx) => {
    let locationName: string | null = locationNameForm || null;
    let wardId: string | null = wardIdForm || null;

    // A site, when given, wins — it denormalises its name + ward onto the activity.
    if (siteId) {
      const siteRows = await tx
        .select({ id: communitySites.id, name: communitySites.name, wardId: communitySites.wardId })
        .from(communitySites)
        .where(eq(communitySites.id, siteId))
        .limit(1);
      if (siteRows.length === 0) return { ok: false as const, error: 'Selected site not found' };
      locationName = siteRows[0]!.name;
      wardId = siteRows[0]!.wardId;
    }

    const [inserted] = await tx
      .insert(activities)
      .values({
        title,
        type,
        scheduledAt: scheduledAt!,
        locationName,
        wardId,
        ownerPersonId: claims.sub,
        status,
        expectedAttendance: expectedRaw ? Number(expectedRaw) : null,
        actualAttendance: actualRaw ? Number(actualRaw) : null,
        candidateAttended,
        outcomeNotes: notes || null,
        followUpRequired,
      })
      .returning({ id: activities.id });

    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: 'CREATE_ACTIVITY',
      entityType: 'activity',
      entityId: inserted.id,
      afterValue: {
        title, type, status,
        scheduled_at: scheduledAt!.toISOString(),
        ward_id: wardId, site_id: siteId || null, location_name: locationName,
      },
      context: { source: wantsJson ? 'quick_add' : 'meetings_page' },
    });

    return { ok: true as const, id: inserted.id };
  });

  if (!result.ok) return fail(req, wantsJson, result.error);

  if (wantsJson) return NextResponse.json({ ok: true, id: result.id });
  const dest = new URL('/meetings', req.url);
  dest.searchParams.set('activityCreated', result.id);
  return NextResponse.redirect(dest, 303);
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function fail(req: NextRequest, wantsJson: boolean, msg: string): NextResponse {
  if (wantsJson) return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  const referer = req.headers.get('referer') ?? new URL('/meetings?action=new-activity', req.url).toString();
  const url = new URL(referer);
  url.searchParams.set('activityError', msg);
  return NextResponse.redirect(url, 303);
}
