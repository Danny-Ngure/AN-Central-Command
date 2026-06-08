import { NextRequest, NextResponse } from 'next/server';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';
import { dedupStationsWithAudit } from '@/lib/dedup-stations';

export const runtime = 'nodejs';

// POST /api/polling-stations/dedup
//
// Form fields:
//   wardId — optional. Present = single-ward sweep; absent = constituency-wide.
//
// Delegates to lib/dedup-stations.ts so the same algorithm is shared with the
// auto-run-after-voter-import path.

const PRIVILEGED_ROLES = new Set([
  'candidate',
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'tech_lead',
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  if (!PRIVILEGED_ROLES.has(claims.role)) {
    return NextResponse.redirect(new URL('/wards?reason=insufficient_role', req.url));
  }

  const form = await req.formData();
  const wardIdRaw = form.get('wardId');
  const wardId = typeof wardIdRaw === 'string' && wardIdRaw ? wardIdRaw : null;

  const result = await withRlsTx(claims, async (tx) => {
    return dedupStationsWithAudit(tx, claims, {
      wardIds: wardId ? [wardId] : undefined,
      source: wardId ? 'ward_detail_ui' : 'wards_index_ui',
    });
  });

  if (wardId) {
    const url = new URL(`/wards/${wardId}`, req.url);
    url.searchParams.set('merged', String(result.merged));
    url.searchParams.set('deleted', String(result.deleted));
    return NextResponse.redirect(url);
  } else {
    const url = new URL('/wards', req.url);
    url.searchParams.set('merged', String(result.merged));
    url.searchParams.set('deleted', String(result.deleted));
    url.searchParams.set('wardsSwept', String(result.perWard.length));
    return NextResponse.redirect(url);
  }
}
