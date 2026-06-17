import Link from 'next/link';
import { sql, eq, and, isNull, isNotNull } from 'drizzle-orm';
import { communitySites, pollingStations, voters, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

// /wards/coverage — Constituency-wide outreach coverage.
//
// A static segment, so it takes routing precedence over /wards/[id]. Aggregates
// the same live tables the wards index uses (voters / stations / sites) but rolls
// them up to a constituency total plus a per-ward breakdown, so the campaign can
// see at a glance where outreach is strong and where it is thin.

export default async function ConstituencyCoverage() {
  const claims = await getServerAuthOrRedirect();

  const data = await withRlsTx(claims, async (tx) => {
    const wardRows = await tx
      .select({ id: wards.id, name: wards.name })
      .from(wards)
      .orderBy(wards.name);

    const [voterCounts, phoneCounts, stationCounts, siteCounts, sitesVisitedCounts] = await Promise.all([
      tx.select({ wardId: voters.wardId, c: sql<number>`count(*)::int` })
        .from(voters).where(isNull(voters.consentWithdrawnAt)).groupBy(voters.wardId),
      tx.select({ wardId: voters.wardId, c: sql<number>`count(*)::int` })
        .from(voters).where(and(isNull(voters.consentWithdrawnAt), isNotNull(voters.phone))).groupBy(voters.wardId),
      tx.select({ wardId: pollingStations.wardId, c: sql<number>`count(*)::int` })
        .from(pollingStations).where(eq(pollingStations.active, true)).groupBy(pollingStations.wardId),
      tx.select({ wardId: communitySites.wardId, c: sql<number>`count(*)::int` })
        .from(communitySites).where(isNull(communitySites.deletedAt)).groupBy(communitySites.wardId),
      tx.select({ wardId: communitySites.wardId, c: sql<number>`count(*)::int` })
        .from(communitySites).where(and(isNull(communitySites.deletedAt), eq(communitySites.visited, true))).groupBy(communitySites.wardId),
    ]);

    const voterMap   = new Map(voterCounts.map((r) => [r.wardId, r.c]));
    const phoneMap   = new Map(phoneCounts.map((r) => [r.wardId, r.c]));
    const stationMap = new Map(stationCounts.map((r) => [r.wardId, r.c]));
    const siteMap    = new Map(siteCounts.map((r) => [r.wardId, r.c]));
    const visitedMap = new Map(sitesVisitedCounts.map((r) => [r.wardId, r.c]));

    return wardRows.map((w) => ({
      ...w,
      voterCount: voterMap.get(w.id) ?? 0,
      votersWithPhone: phoneMap.get(w.id) ?? 0,
      stationCount: stationMap.get(w.id) ?? 0,
      siteCount: siteMap.get(w.id) ?? 0,
      sitesVisited: visitedMap.get(w.id) ?? 0,
    }));
  });

  const totals = data.reduce(
    (a, w) => ({
      voters: a.voters + w.voterCount,
      phone: a.phone + w.votersWithPhone,
      stations: a.stations + w.stationCount,
      sites: a.sites + w.siteCount,
      visited: a.visited + w.sitesVisited,
    }),
    { voters: 0, phone: 0, stations: 0, sites: 0, visited: 0 },
  );
  const visitedPct = totals.sites > 0 ? (totals.visited / totals.sites) * 100 : 0;
  const phonePct = totals.voters > 0 ? (totals.phone / totals.voters) * 100 : 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Link href="/wards" className="text-xs font-semibold text-brand-aqua hover:text-brand-skyBlue">← All Wards</Link>
        </div>
        <h1 className="text-2xl font-bold text-brand-textActive">📊 Constituency Coverage</h1>
        <p className="text-sm text-brand-textMuted">
          Outreach across all {data.length} wards of Nyali — site visits and voter phone reach, live from your data.
        </p>
      </header>

      {/* Headline donut + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-6 items-center rounded-2xl border border-brand-border bg-brand-cardBg/50 p-6">
        <CoverageDonut pct={visitedPct} visited={totals.visited} total={totals.sites} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Voters" value={totals.voters} />
          <Kpi label="Polling stations" value={totals.stations} />
          <Kpi label="Community sites" value={totals.sites} />
          <Kpi label="Sites visited" value={totals.visited} />
          <Kpi label="Phone reach" value={`${phonePct.toFixed(0)}%`} />
          <Kpi label="Sites covered" value={`${visitedPct.toFixed(0)}%`} />
        </div>
      </div>

      {/* Per-ward breakdown */}
      <h2 className="text-lg font-bold text-brand-textActive">Coverage by ward</h2>
      <div className="space-y-3">
        {data.map((w) => {
          const wVisited = w.siteCount > 0 ? (w.sitesVisited / w.siteCount) * 100 : 0;
          const wPhone = w.voterCount > 0 ? (w.votersWithPhone / w.voterCount) * 100 : 0;
          return (
            <Link
              key={w.id}
              href={`/wards/${w.id}?tab=sites&siteTab=coverage`}
              className="block rounded-xl border border-brand-border bg-brand-cardBg/50 p-4 hover:border-brand-burnt transition"
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <h3 className="text-base font-bold text-brand-textActive">{w.name}</h3>
                <span className="text-xs text-brand-textMuted tabular-nums">
                  {w.sitesVisited}/{w.siteCount} sites · {w.voterCount.toLocaleString()} voters · {w.stationCount} stations
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <Bar label="Sites visited" value={wVisited} tone="success" />
                <Bar label="Phone reach" value={wPhone} tone="brand" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CoverageDonut({ pct, visited, total }: { pct: number; visited: number; total: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, pct) / 100) * circ;
  return (
    <div className="relative h-[140px] w-[140px] shrink-0 mx-auto">
      <svg viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="14" className="text-black/10" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} className="text-brand-success"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-brand-textActive tabular-nums">{pct.toFixed(0)}%</span>
        <span className="text-[10px] uppercase tracking-wider text-brand-textMuted">{visited}/{total} sites</span>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold text-brand-textActive tabular-nums">
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
      <div className="mt-0.5 h-2 rounded-full bg-black/10 overflow-hidden">
        <div className={`h-full ${fill}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
