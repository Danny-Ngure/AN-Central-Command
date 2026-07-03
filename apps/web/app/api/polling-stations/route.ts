import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { auditLog, db, pollingStations } from '@an/db';
import { err, ok, withAuth, withRlsTx } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/polling-stations — add ONE polling station.
//
// RLS (polling_stations_write_leadership) restricts this to leadership; ward-scoped
// members get a friendly permission error. IEBC codes are unique + immutable, but a
// station being logged in the field may not have its official code yet, so when none
// is given we mint a temporary "TMP-xxxxxxxx" code the office can replace later.
// registeredVoters is NOT NULL — default 0 until the register is loaded. Location
// defaults to the ward centre (same convention as sites/villages).

const WARD_CENTROIDS: Record<string, [number, number]> = {
  '22222222-0000-4000-8000-000000000001': [39.702, -4.009], // Kadzandani
  '22222222-0000-4000-8000-000000000002': [39.688, -4.041], // Kongowea
  '22222222-0000-4000-8000-000000000003': [39.711, -4.044], // Mkomani
  '22222222-0000-4000-8000-000000000004': [39.689, -4.026], // Frere Town
  '22222222-0000-4000-8000-000000000005': [39.709, -4.026], // Ziwa La Ng'ombe
};
const DEFAULT_CENTROID: [number, number] = [39.702, -4.032]; // Nyali centre

interface Body {
  name?: string;
  wardId?: string;
  iebcCode?: string | null;
  registeredVoters?: number | null;
}

export const POST = withAuth(async (req: NextRequest, { claims }) => {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Body must be JSON', 400);
  }

  const name = (body.name ?? '').trim();
  if (!name) return err('PS_NAME_REQUIRED', 'Station name is required', 400);
  if (name.length > 200) return err('PS_NAME_TOO_LONG', 'Name must be 200 characters or fewer', 400);
  if (!body.wardId) return err('PS_WARD_REQUIRED', 'A ward is required', 400);

  const voters = body.registeredVoters;
  if (voters != null && (!Number.isInteger(voters) || voters < 0)) {
    return err('PS_BAD_VOTERS', 'Registered voters must be a non-negative whole number', 400);
  }

  const iebcCode = (body.iebcCode ?? '').trim() || `TMP-${randomUUID().slice(0, 8)}`;
  const [lng, lat] = WARD_CENTROIDS[body.wardId] ?? DEFAULT_CENTROID;

  let created: { id: string; name: string };
  try {
    const inserted = await withRlsTx(claims, async (tx) =>
      tx
        .insert(pollingStations)
        .values({
          name,
          wardId: body.wardId!,
          iebcCode,
          registeredVoters: voters ?? 0,
          location: sql`ST_GeomFromText(${`POINT(${lng} ${lat})`}, 4326)` as any,
        })
        .returning({ id: pollingStations.id, name: pollingStations.name }),
    );
    created = inserted[0]!;
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (/iebc_code/i.test(msg) && /unique|duplicate/i.test(msg)) {
      return err('PS_DUPLICATE_CODE', 'That IEBC code already exists', 409);
    }
    // RLS denial — only leadership can add polling stations.
    return err(
      'PS_INSERT_DENIED',
      'Only campaign leadership can add polling stations. Ask a coordinator or manager to add it.',
      403,
    );
  }

  try {
    await db.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: 'CREATE_POLLING_STATION',
      entityType: 'polling_station',
      entityId: created.id,
      afterValue: { name, wardId: body.wardId, iebcCode, registeredVoters: voters ?? 0 },
      context: { source: 'add_hub_ui' },
    });
  } catch {
    /* non-fatal */
  }

  return ok({ station: created });
});
