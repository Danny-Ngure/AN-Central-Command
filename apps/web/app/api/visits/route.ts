import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { visits } from '@an/db';
import { err, ok, withAuth, withRlsTx } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/visits — record a field visit (SRS FR-050).
//
// Idempotent: the client supplies a UUIDv7 `id`. On retry (network flake, app
// killed mid-sync), the same id arrives again and Postgres' ON CONFLICT DO NOTHING
// turns the duplicate into a no-op.
//
// RLS policy `visits_insert_self` requires visiting_person_id = current user.
// We force that to claims.sub regardless of what the client sends — defence in
// depth against a malicious client trying to attribute visits to someone else.

const VALID_PURPOSES = new Set([
  'door_to_door', 'courtesy_call', 'baraza', 'leader_meeting',
  'site_assessment', 'follow_up', 'other',
]);

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface Body {
  id?: string;
  location?: { lng?: number; lat?: number };
  villageId?: string | null;
  purpose?: string;
  engagementCount?: number | null;
  notes?: string | null;
}

export const POST = withAuth(async (req: NextRequest, { claims }) => {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Body must be JSON', 400);
  }

  // Validation — strict; failure → 400 with a specific code.
  if (!body.id || !UUID_V7_REGEX.test(body.id)) {
    return err('VISIT_INVALID_ID', 'id must be a UUIDv7', 400);
  }
  if (!body.location || typeof body.location.lng !== 'number' || typeof body.location.lat !== 'number') {
    return err('VISIT_INVALID_LOCATION', 'location.lng and location.lat must be numbers', 400);
  }
  if (Math.abs(body.location.lng) > 180 || Math.abs(body.location.lat) > 90) {
    return err('VISIT_INVALID_LOCATION', 'location out of range', 400);
  }
  if (!body.purpose || !VALID_PURPOSES.has(body.purpose)) {
    return err('VISIT_INVALID_PURPOSE', `purpose must be one of: ${[...VALID_PURPOSES].join(', ')}`, 400);
  }
  if (body.engagementCount != null && (!Number.isInteger(body.engagementCount) || body.engagementCount < 0)) {
    return err('VISIT_INVALID_ENGAGEMENT', 'engagementCount must be a non-negative integer', 400);
  }

  const lng = body.location.lng;
  const lat = body.location.lat;

  // Insert in an RLS-scoped transaction. The policy verifies visiting_person_id.
  const inserted = await withRlsTx(claims, async (tx) =>
    tx
      .insert(visits)
      .values({
        id: body.id!,
        visitingPersonId: claims.sub,
        // PostGIS POINT — values inlined via sql.raw because PostGIS doesn't
        // accept bind parameters inside ST_GeomFromText. Both numbers are
        // already validated above.
        location: sql`ST_GeomFromText(${`POINT(${lng} ${lat})`}, 4326)` as any,
        villageId: body.villageId ?? null,
        purpose: body.purpose as any,
        engagementCount: body.engagementCount ?? null,
        notes: body.notes ?? null,
      })
      .onConflictDoNothing({ target: visits.id })
      .returning({ id: visits.id, createdAt: visits.createdAt }),
  );

  // If RLS denied the insert (e.g., the row's visiting_person_id didn't match
  // the session) we'd never get here — postgres throws. If the row already
  // existed, inserted is empty (idempotent no-op).
  const wasInsert = inserted.length > 0;
  return ok({
    id: body.id,
    accepted: true,
    duplicate: !wasInsert,
    serverTime: new Date().toISOString(),
  });
});
