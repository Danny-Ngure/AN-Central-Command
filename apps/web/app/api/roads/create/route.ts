import { NextRequest, NextResponse } from 'next/server';
import { auditLog, roads } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/roads/create — add an MP / NG-CDF road project, village → village.
// Plain <form> post. Required: name. Everything else optional.
const uuid = (s: string) => (/^[0-9a-f-]{36}$/i.test(s) ? s : null);
const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  const f = await req.formData();
  const name = clamp(String(f.get('name') ?? '').trim(), 200);
  if (!name) {
    const back = new URL(req.headers.get('referer') ?? '/roads', req.url);
    back.searchParams.set('roadError', 'Road name is required');
    return NextResponse.redirect(back, 303);
  }
  const wardId = uuid(String(f.get('wardId') ?? ''));
  const fromVillageId = uuid(String(f.get('fromVillageId') ?? ''));
  const toVillageId = uuid(String(f.get('toVillageId') ?? ''));
  const status = clamp(String(f.get('status') ?? '').trim(), 40) || null;
  const funding = clamp(String(f.get('funding') ?? '').trim(), 40) || null;
  const surface = clamp(String(f.get('surface') ?? '').trim(), 40) || null;
  const notes = clamp(String(f.get('notes') ?? '').trim(), 1000) || null;
  const lenRaw = String(f.get('lengthKm') ?? '').trim();
  const lengthKm = lenRaw && !Number.isNaN(Number(lenRaw)) ? lenRaw : null;
  const mpProject = String(f.get('mpProject') ?? '') === 'on' || String(f.get('mpProject') ?? '') === 'true';

  await withRlsTx(claims, async (tx) => {
    const [row] = await tx.insert(roads).values({
      name, wardId, fromVillageId, toVillageId, status, funding, surface, notes, lengthKm, mpProject,
    }).returning({ id: roads.id });
    await tx.insert(auditLog).values({
      actorPersonId: claims.sub, actorRole: claims.role,
      action: 'CREATE_ROAD', entityType: 'road', entityId: row.id,
      afterValue: { name, ward_id: wardId, status, funding },
      context: { source: 'roads_page' },
    });
  });

  const back = new URL(req.headers.get('referer') ?? '/roads', req.url);
  back.searchParams.set('roadCreated', '1');
  return NextResponse.redirect(back, 303);
}
