import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { villages } from '@an/db';
import { err, ok, withAuth, withRlsTx } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/villages — add a village to a ward.
//
// Required: wardId, name. The schema needs a centroid (geometry NOT NULL); informal
// settlements may not have precise coordinates yet (SRS BR-010.1), so we default the
// centroid to the ward's approximate centre and the team can refine it on the map later.
// RLS (villages_write_leadership / villages_write_ward) decides who may insert where.

const WARD_CENTROIDS: Record<string, [number, number]> = {
  '22222222-0000-4000-8000-000000000001': [39.702, -4.009], // Kadzandani
  '22222222-0000-4000-8000-000000000002': [39.688, -4.041], // Kongowea
  '22222222-0000-4000-8000-000000000003': [39.711, -4.044], // Mkomani
  '22222222-0000-4000-8000-000000000004': [39.689, -4.026], // Frere Town
  '22222222-0000-4000-8000-000000000005': [39.709, -4.026], // Ziwa La Ng'ombe
};
const DEFAULT_CENTROID: [number, number] = [39.702, -4.032]; // Nyali centre

interface Body {
  wardId?: string;
  name?: string;
  populationEstimate?: number | null;
}

export const POST = withAuth(async (req: NextRequest, { claims }) => {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Body must be JSON', 400);
  }

  const name = (body.name ?? '').trim();
  if (!name) return err('VILLAGE_NAME_REQUIRED', 'Village name is required', 400);
  if (name.length > 120) return err('VILLAGE_NAME_TOO_LONG', 'Village name must be 120 characters or fewer', 400);
  if (!body.wardId) return err('VILLAGE_WARD_REQUIRED', 'A ward is required', 400);

  const pop = body.populationEstimate;
  if (pop != null && (!Number.isInteger(pop) || pop < 0)) {
    return err('VILLAGE_BAD_POPULATION', 'Population estimate must be a non-negative whole number', 400);
  }

  const [lng, lat] = WARD_CENTROIDS[body.wardId] ?? DEFAULT_CENTROID;

  try {
    const inserted = await withRlsTx(claims, async (tx) =>
      tx
        .insert(villages)
        .values({
          wardId: body.wardId!,
          name,
          populationEstimate: pop ?? null,
          // PostGIS POINT — inlined string (validated numbers); ST_GeomFromText.
          centroid: sql`ST_GeomFromText(${`POINT(${lng} ${lat})`}, 4326)` as any,
        })
        .returning({ id: villages.id, name: villages.name }),
    );
    return ok({ village: inserted[0] });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes('villages_ward_name_unique')) {
      return err('VILLAGE_DUPLICATE', 'A village with that name already exists in this ward', 409);
    }
    // RLS denial surfaces as an insert failure.
    return err('VILLAGE_INSERT_DENIED', 'Could not add village — you may not have permission for this ward.', 403);
  }
});
