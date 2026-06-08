import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { activities, auditLog, communitySites } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/activities/create  (multipart/form-data)
//
// Schedules an activity AT a community_site. `siteId` is required — the
// site's name + ward gets denormalised onto activities.locationName /
// activities.wardId for fast list-views.
//
// Required: title + type + scheduledAt + siteId.
// Optional: expectedAttendance + outcomeNotes (acts as agenda for planned).

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  const form = await req.formData();
  const siteId      = String(form.get('siteId') ?? '').trim();
  const title       = clamp(String(form.get('title') ?? '').trim(), TITLE_MAX);
  const typeRaw     = String(form.get('type') ?? '').trim();
  const scheduledAtRaw = String(form.get('scheduledAt') ?? '').trim();
  const agenda      = clamp(String(form.get('agenda') ?? '').trim(), FREE_TEXT_MAX);
  const expectedAttendanceRaw = String(form.get('expectedAttendance') ?? '').trim();

  const errors: string[] = [];
  if (!siteId)               errors.push('Site is required');
  if (!title)                errors.push('Title is required');
  if (!scheduledAtRaw)       errors.push('Date / time required');
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) errors.push('Date / time invalid');
  const type: ActivityType = ACTIVITY_TYPES.includes(typeRaw as ActivityType)
    ? (typeRaw as ActivityType)
    : 'other';

  if (errors.length > 0) return back(req, errors.join('; '));

  const result = await withRlsTx(claims, async (tx) => {
    const siteRows = await tx
      .select({ id: communitySites.id, name: communitySites.name, wardId: communitySites.wardId })
      .from(communitySites)
      .where(eq(communitySites.id, siteId))
      .limit(1);
    if (siteRows.length === 0) return null;
    const site = siteRows[0]!;

    const [inserted] = await tx
      .insert(activities)
      .values({
        title,
        type,
        scheduledAt: scheduledAt!,
        locationName: site.name,
        wardId: site.wardId,
        ownerPersonId: claims.sub,
        status: 'planned',
        expectedAttendance: expectedAttendanceRaw ? Number(expectedAttendanceRaw) : null,
        outcomeNotes: agenda || null,
      })
      .returning({ id: activities.id });

    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: 'CREATE_ACTIVITY',
      entityType: 'activity',
      entityId: inserted.id,
      afterValue: {
        title,
        type,
        scheduled_at: scheduledAt!.toISOString(),
        site_id: siteId,
        site_name: site.name,
        ward_id: site.wardId,
      },
      context: { source: 'meetings_page' },
    });

    return inserted;
  });

  if (!result) return back(req, 'Selected site not found');

  const dest = new URL('/meetings', req.url);
  dest.searchParams.set('activityCreated', result.id);
  return NextResponse.redirect(dest, 303);
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function back(req: NextRequest, msg: string): NextResponse {
  const referer = req.headers.get('referer') ?? new URL('/meetings?action=new-activity', req.url).toString();
  const url = new URL(referer);
  url.searchParams.set('activityError', msg);
  return NextResponse.redirect(url, 303);
}
