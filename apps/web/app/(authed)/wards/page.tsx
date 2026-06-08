import Link from 'next/link';
import { sql, eq, and, isNull, isNotNull } from 'drizzle-orm';
import { communitySites, pollingStations, voters, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

// /wards — index page. Lists every ward visible to the user, with a compact KPI row
// per ward (voters / stations / sites / visited %). Click-through to /wards/[id].
//
// Counts are derived from the live tables (voters / polling_stations / community_sites)
// via parallel GROUP BY queries — same pattern as the dashboard, NOT correlated subqueries.

// Per-ward card colour, cycling the brand palette so each ward reads distinctly.
// Full class strings (not interpolated fragments) so Tailwind JIT generates them.
const WARD_CARD_TONES = [
  { border: 'border-l-brand-burnt', tint: 'bg-brand-burnt/[0.06]', head: 'text-brand-burnt', hover: 'hover:border-brand-burnt' },
  { border: 'border-l-brand-teal',  tint: 'bg-brand-teal/[0.06]',  head: 'text-brand-teal',  hover: 'hover:border-brand-teal' },
  { border: 'border-l-brand-rust',  tint: 'bg-brand-rust/[0.06]',  head: 'text-brand-rust',  hover: 'hover:border-brand-rust' },
  { border: 'border-l-brand-brown', tint: 'bg-brand-brown/[0.06]', head: 'text-brand-brown', hover: 'hover:border-brand-brown' },
  { border: 'border-l-brand-olive', tint: 'bg-brand-olive/[0.06]', head: 'text-brand-olive', hover: 'hover:border-brand-olive' },
];

interface PageProps {
  searchParams: { merged?: string; deleted?: string; wardsSwept?: string };
}

export default async function WardsIndex({ searchParams }: PageProps) {
  const claims = await getServerAuthOrRedirect();
  const merged = Number(searchParams.merged ?? 0);
  const deleted = Number(searchParams.deleted ?? 0);
  const wardsSwept = Number(searchParams.wardsSwept ?? 0);

  const data = await withRlsTx(claims, async (tx) => {
    const wardRowsRaw = await tx
      .select({
        id: wards.id,
        name: wards.name,
      })
      .from(wards)
      .orderBy(wards.name);

    const [voterCounts, phoneCounts, stationCounts, siteCounts, sitesVisitedCounts] = await Promise.all([
      tx
        .select({ wardId: voters.wardId, c: sql<number>`count(*)::int` })
        .from(voters)
        .where(isNull(voters.consentWithdrawnAt))
        .groupBy(voters.wardId),
      tx
        .select({ wardId: voters.wardId, c: sql<number>`count(*)::int` })
        .from(voters)
        .where(and(isNull(voters.consentWithdrawnAt), isNotNull(voters.phone)))
        .groupBy(voters.wardId),
      tx
        .select({ wardId: pollingStations.wardId, c: sql<number>`count(*)::int` })
        .from(pollingStations)
        .where(eq(pollingStations.active, true))
        .groupBy(pollingStations.wardId),
      tx
        .select({ wardId: communitySites.wardId, c: sql<number>`count(*)::int` })
        .from(communitySites)
        .where(isNull(communitySites.deletedAt))
        .groupBy(communitySites.wardId),
      tx
        .select({ wardId: communitySites.wardId, c: sql<number>`count(*)::int` })
        .from(communitySites)
        .where(and(isNull(communitySites.deletedAt), eq(communitySites.visited, true)))
        .groupBy(communitySites.wardId),
    ]);

    const voterMap        = new Map(voterCounts.map((r) => [r.wardId, r.c]));
    const phoneMap        = new Map(phoneCounts.map((r) => [r.wardId, r.c]));
    const stationMap      = new Map(stationCounts.map((r) => [r.wardId, r.c]));
    const siteMap         = new Map(siteCounts.map((r) => [r.wardId, r.c]));
    const visitedMap      = new Map(sitesVisitedCounts.map((r) => [r.wardId, r.c]));

    return wardRowsRaw.map((w) => ({
      ...w,
      voterCount:      voterMap.get(w.id)    ?? 0,
      votersWithPhone: phoneMap.get(w.id)    ?? 0,
      stationCount:    stationMap.get(w.id)  ?? 0,
      siteCount:       siteMap.get(w.id)     ?? 0,
      sitesVisited:    visitedMap.get(w.id)  ?? 0,
    }));
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Wards</h1>
        <p className="text-sm text-brand-textMuted">
          Five wards in Nyali Constituency. All numbers are live from your imported voter register.
          Click a ward to see polling stations, sites, voter demographics and outreach coverage.
        </p>
      </header>

      {/* Sweep result banner */}
      {(merged > 0 || deleted > 0) && (
        <div className="rounded-lg border border-brand-success/40 bg-brand-success/10 px-4 py-3 text-sm text-brand-success space-y-1">
          <div className="font-semibold uppercase tracking-wider text-xs">
            ✓ Cleanup complete · {wardsSwept || 5} wards swept
          </div>
          {merged > 0 && (
            <div>
              Merged <strong>{merged}</strong> polling station{merged === 1 ? '' : 's'} — seed stations
              absorbed their auto-created twins (voters moved, IEBC codes + historical turnout kept).
            </div>
          )}
          {deleted > 0 && (
            <div>
              Deleted <strong>{deleted}</strong> empty duplicate{deleted === 1 ? '' : 's'} with no fuzzy match in the data.
            </div>
          )}
        </div>
      )}

      <h2 className="text-lg font-bold text-brand-textActive">All wards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((w, i) => {
          const phonePct   = w.voterCount > 0 ? (w.votersWithPhone / w.voterCount) * 100 : 0;
          const visitedPct = w.siteCount   > 0 ? (w.sitesVisited   / w.siteCount)   * 100 : 0;
          const tone = WARD_CARD_TONES[i % WARD_CARD_TONES.length];
          return (
            <Link
              key={w.id}
              href={`/wards/${w.id}`}
              className={`block rounded-xl border border-brand-border border-l-4 ${tone.border} ${tone.tint} p-5 shadow-sm hover:shadow-md ${tone.hover} transition`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className={`text-lg font-extrabold ${tone.head}`}>{w.name}</h2>
                <span className="text-xs text-brand-textMuted tabular-nums">
                  {w.voterCount.toLocaleString()} voters
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <Kpi label="Stations" value={w.stationCount} />
                <Kpi label="Sites" value={w.siteCount} />
                <Kpi label="With phone" value={`${phonePct.toFixed(0)}%`} />
              </div>
              <div className="mt-3 space-y-1.5">
                <Bar label="Phone reach" value={phonePct} tone="brand" />
                <Bar label="Sites visited" value={visitedPct} tone="success" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xl font-extrabold text-brand-textActive tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted">{label}</div>
    </div>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone: 'brand' | 'success' }) {
  const fill = tone === 'brand' ? 'bg-brand-skyBlue' : 'bg-brand-success';
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-brand-textMuted">
        <span>{label}</span>
        <span>{value.toFixed(0)}%</span>
      </div>
      <div className="mt-0.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div className={`h-full ${fill}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
