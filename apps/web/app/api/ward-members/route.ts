import { NextRequest } from 'next/server';
import { db, people } from '@an/db';
import { err, ok, withAuth } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/ward-members — add a campaign team member to a ward.
// Required: wardId, fullName, phone, role. Leadership may add to any ward; a ward
// coordinator may add to their own ward.

const ALLOWED_ROLES = new Set(['canvasser', 'polling_agent', 'polling_station_lead', 'influence_liaison']);
const LEADERSHIP = new Set(['candidate', 'campaign_manager', 'chief_strategist', 'constituency_coordinator', 'tech_lead', 'patron_ceo']);

interface Body { wardId?: string; fullName?: string; phone?: string; role?: string; title?: string }

export const POST = withAuth(async (req: NextRequest, { claims }) => {
  let body: Body;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Body must be JSON', 400); }

  const fullName = (body.fullName ?? '').trim();
  const phone = (body.phone ?? '').trim();
  const role = body.role ?? '';
  const wardId = body.wardId ?? '';
  const title = (body.title ?? '').trim() || null;

  if (!fullName) return err('MEMBER_NAME_REQUIRED', 'Name is required', 400);
  if (!phone) return err('MEMBER_PHONE_REQUIRED', 'Phone number is required', 400);
  if (!wardId) return err('MEMBER_WARD_REQUIRED', 'A ward is required', 400);
  if (!ALLOWED_ROLES.has(role)) return err('MEMBER_BAD_ROLE', 'Choose a valid role', 400);

  const allowed =
    LEADERSHIP.has(claims.role) ||
    ((claims.role === 'ward_coordinator' || claims.role === 'assistant_ward_coordinator') && claims.wardId === wardId);
  if (!allowed) return err('MEMBER_FORBIDDEN', 'You may not add members to this ward.', 403);

  try {
    const inserted = await db
      .insert(people)
      .values({ fullName, phone, role: role as 'canvasser', wardId, title, active: true })
      .returning({ id: people.id });
    return ok({ id: inserted[0].id });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes('people_phone_unique')) return err('MEMBER_PHONE_DUP', 'That phone number is already in the system', 409);
    return err('MEMBER_INSERT_FAILED', 'Could not add member', 500);
  }
});
