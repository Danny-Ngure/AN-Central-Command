import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { auditLog, communitySites, db } from '@an/db';
import { err, ok, withAuth, withRlsTx } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/sites — add ONE community site (church / mosque / school / market / …).
//
// The single-entry, layman counterpart to the bulk /data-import flow, used by the
// "+ Add" hub. RLS (sites_write_ward) decides who may insert where: leadership can
// add to any ward; ward-scoped members (incl. canvassers) can add to their own ward.
//
// Required: type, name, wardId. Everything else is optional. The schema needs a
// location (geometry NOT NULL); a field worker rarely has coordinates, so we default
// to the ward's approximate centre — the same convention /api/villages uses — and the
// point can be refined on the map later.

const WARD_CENTROIDS: Record<string, [number, number]> = {
  '22222222-0000-4000-8000-000000000001': [39.702, -4.009], // Kadzandani
  '22222222-0000-4000-8000-000000000002': [39.688, -4.041], // Kongowea
  '22222222-0000-4000-8000-000000000003': [39.711, -4.044], // Mkomani
  '22222222-0000-4000-8000-000000000004': [39.689, -4.026], // Frere Town
  '22222222-0000-4000-8000-000000000005': [39.709, -4.026], // Ziwa La Ng'ombe
};
const DEFAULT_CENTROID: [number, number] = [39.702, -4.032]; // Nyali centre

// Mirror of the schema's controlled vocabulary (packages/db/src/schema/community.ts).
const SITE_TYPES = new Set([
  'church', 'mosque', 'madrasa',
  'school_primary', 'school_secondary', 'school_other', 'school_public', 'school_private', 'school_tertiary',
  'welfare_group', 'market', 'shopping_center', 'boda_stage', 'matatu_stage',
  'chama', 'sacco', 'self_help_group', 'community_hall', 'social_hall',
  'sports_club', 'youth_center', 'health_facility', 'government_office', 'other',
]);

interface Body {
  type?: string;
  name?: string;
  wardId?: string;
  villageId?: string | null;
  contactPersonName?: string | null;
  contactPhone?: string | null;
  contactRole?: string | null;
  areaName?: string | null;
  estimatedSize?: number | null;
}

// Normalise a Kenyan phone to +254XXXXXXXXX; pass through anything that doesn't fit
// (contact phones are free-text and not uniqueness-constrained).
function normPhone(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '');
  if (!s) return '';
  let d = s.replace(/^\+/, '');
  if (d.startsWith('254')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return /^[17]\d{8}$/.test(d) ? `+254${d}` : s;
}

export const POST = withAuth(async (req: NextRequest, { claims }) => {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Body must be JSON', 400);
  }

  const type = (body.type ?? '').trim();
  const name = (body.name ?? '').trim();
  if (!SITE_TYPES.has(type)) return err('SITE_BAD_TYPE', 'Pick a valid site type', 400);
  if (!name) return err('SITE_NAME_REQUIRED', 'Name is required', 400);
  if (name.length > 200) return err('SITE_NAME_TOO_LONG', 'Name must be 200 characters or fewer', 400);
  if (!body.wardId) return err('SITE_WARD_REQUIRED', 'A ward is required', 400);

  const size = body.estimatedSize;
  if (size != null && (!Number.isInteger(size) || size < 0)) {
    return err('SITE_BAD_SIZE', 'Estimated size must be a non-negative whole number', 400);
  }

  const contactPersonName = (body.contactPersonName ?? '').trim() || null;
  const contactPhoneRaw = (body.contactPhone ?? '').trim();
  const contactPhone = contactPhoneRaw ? normPhone(contactPhoneRaw) : null;
  const contactRole = (body.contactRole ?? '').trim() || null;
  const areaName = (body.areaName ?? '').trim() || null;
  const villageId = (body.villageId ?? '') || null;

  const [lng, lat] = WARD_CENTROIDS[body.wardId] ?? DEFAULT_CENTROID;

  let created: { id: string; name: string };
  try {
    const inserted = await withRlsTx(claims, async (tx) =>
      tx
        .insert(communitySites)
        .values({
          type: type as any,
          name,
          wardId: body.wardId!,
          villageId,
          contactPersonName,
          contactPhone,
          contactRole,
          areaName,
          estimatedSize: size ?? null,
          location: sql`ST_GeomFromText(${`POINT(${lng} ${lat})`}, 4326)` as any,
        })
        .returning({ id: communitySites.id, name: communitySites.name }),
    );
    created = inserted[0]!;
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    // RLS denial surfaces as an insert failure.
    return err(
      'SITE_INSERT_DENIED',
      'Could not add this — you may only add sites in your own ward. Ask a coordinator for other wards.',
      403,
    );
  }

  // Best-effort audit (append-only; never block the create on it).
  try {
    await db.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: 'CREATE_SITE',
      entityType: 'community_site',
      entityId: created.id,
      afterValue: { type, name, wardId: body.wardId, villageId, contactPersonName, hasPhone: !!contactPhone },
      context: { source: 'add_hub_ui' },
    });
  } catch {
    /* non-fatal */
  }

  return ok({ site: created });
});
