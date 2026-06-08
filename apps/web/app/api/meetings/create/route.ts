import { NextRequest, NextResponse } from 'next/server';
import { auditLog, meetings } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/meetings/create  (multipart/form-data via a plain <form>)
//
// Schedules a meeting. Required: title + scheduledAt + type. Optional:
// invitees (array of person IDs), location (free text), agenda, plus a
// "send WhatsApp" affordance handled client-side via wa.me deeplink in
// the success redirect (the URL carries the phone numbers so the page
// can launch a tab per invitee if requested).
//
// All meetings owned by current user (claims.sub). Audit log captured.

const TITLE_MAX = 200;
const FREE_TEXT_MAX = 2000;

const MEETING_TYPES = [
  'internal_strategy',
  'community_baraza',
  'stakeholder',
  'condolence_visit',
  'harambee',
  'courtesy_call',
  'media',
] as const;
type MeetingType = (typeof MEETING_TYPES)[number];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  const form = await req.formData();
  const title       = clamp(String(form.get('title') ?? '').trim(), TITLE_MAX);
  const typeRaw     = String(form.get('type') ?? '').trim();
  const scheduledAtRaw = String(form.get('scheduledAt') ?? '').trim();
  const location    = clamp(String(form.get('location') ?? '').trim(), TITLE_MAX);
  const agenda      = clamp(String(form.get('agenda') ?? '').trim(), FREE_TEXT_MAX);
  const invitees    = form.getAll('invitees').map(String).filter(Boolean);

  const errors: string[] = [];
  if (!title)               errors.push('Title required');
  if (!scheduledAtRaw)      errors.push('Date / time required');
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) errors.push('Date / time invalid');
  const type: MeetingType = MEETING_TYPES.includes(typeRaw as MeetingType)
    ? (typeRaw as MeetingType)
    : 'internal_strategy';

  if (errors.length > 0) {
    return back(req, errors.join('; '));
  }

  const newRow = await withRlsTx(claims, async (tx) => {
    const [inserted] = await tx
      .insert(meetings)
      .values({
        title,
        type,
        scheduledAt: scheduledAt!,
        location: location || null,
        agenda: agenda || null,
        ownerPersonId: claims.sub,
        inviteePersonIds: invitees,
        status: 'scheduled',
      })
      .returning({ id: meetings.id });

    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: 'CREATE_MEETING',
      entityType: 'meeting',
      entityId: inserted.id,
      afterValue: {
        title,
        type,
        scheduled_at: scheduledAt!.toISOString(),
        location: location || null,
        invitee_count: invitees.length,
      },
      context: { source: 'meetings_page' },
    });

    return inserted;
  });

  // Redirect home: /meetings with success flag + new meeting id for scroll-to.
  const dest = new URL('/meetings', req.url);
  dest.searchParams.set('created', newRow.id);
  return NextResponse.redirect(dest, 303);
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function back(req: NextRequest, msg: string): NextResponse {
  const referer = req.headers.get('referer') ?? new URL('/meetings?action=new', req.url).toString();
  const url = new URL(referer);
  url.searchParams.set('meetingError', msg);
  return NextResponse.redirect(url, 303);
}
