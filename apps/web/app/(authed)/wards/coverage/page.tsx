import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { GroupedBarChart } from '@/components/charts/grouped-bar';
import { Pie } from '@/components/charts/pie';
import { NYALI_POLLING_STREAMS } from '@/data/nyali-polling-streams';
import { FLAMES_ROSTER } from '@/data/alfayo-flames';
import { WAREMBO_ROSTER } from '@/app/(authed)/team/page';

// /wards/coverage — Constituency Coverage: a full, graph-driven summary of every ward —
// sites (mosques / churches / boda stages / schools) and how many we've visited, polling
// stations + streams + voters, village reach, and team strength (members / Warembo / Flames).

export const dynamic = 'force-dynamic';

const WARD_ORDER = ['Frere Town', 'Kadzandani', 'Kongowea', 'Mkomani', "Ziwa La Ng'ombe"];
const SHORT: Record<string, string> = {
  'Frere Town': 'Frere Town', Kadzandani: 'Kadzandani', Kongowea: 'Kongowea', Mkomani: 'Mkomani', "Ziwa La Ng'ombe": 'Ziwa',
};
// Poll-palette colours (matching the Analysis section) — teal-blue / orange / cyan /
// emerald, no purple.
const C = {
  burnt: '#ff6600', teal: '#025e73', gold: '#CB9B1B', rust: '#B7410E', olive: '#0d4c5c',
  mosque: '#10b981', church: '#025e73', boda: '#e26d28', school: '#CB9B1B', voters: '#00ccff',
  members: '#ff6600', warembo: '#DB2777', flames: '#0891a8', reached: '#10b981', notyet: '#dc2626',
};
const shortWard = (w: string) => w.replace(/ Ward$/, '');

type SiteRow = { ward: string; type: string; total: number; visited: number };

export default async function ConstituencyCoverage() {
  const claims = await getServerAuthOrRedirect();

  const data = await withRlsTx(claims, async (tx) => {
    const [wardRes, sitesRes, pollRes, villRes, voterRes, memberRes] = await Promise.all([
      tx.execute(sql`SELECT id, name FROM wards ORDER BY name`),
      tx.execute(sql`SELECT w.name AS ward, cs.type::text AS type, count(*)::int AS total,
                       count(*) FILTER (WHERE cs.visited)::int AS visited
                     FROM community_sites cs JOIN wards w ON w.id = cs.ward_id
                     WHERE cs.deleted_at IS NULL GROUP BY w.name, cs.type`),
      tx.execute(sql`SELECT w.name AS ward, count(*)::int AS stations,
                       coalesce(sum(ps.registered_voters),0)::int AS voters
                     FROM polling_stations ps JOIN wards w ON w.id = ps.ward_id
                     WHERE ps.active GROUP BY w.name`),
      tx.execute(sql`SELECT w.name AS ward, count(*)::int AS villages,
                       count(*) FILTER (WHERE nv.vs > 0)::int AS reached,
                       (array_agg(nv.name ORDER BY nv.name) FILTER (WHERE nv.vs = 0))[1:12] AS unvisited_names
                     FROM (SELECT v.id, v.ward_id, v.name, count(s.id) FILTER (WHERE s.visited) AS vs
                           FROM villages v LEFT JOIN community_sites s ON s.village_id = v.id AND s.deleted_at IS NULL
                           WHERE v.deleted_at IS NULL GROUP BY v.id, v.ward_id, v.name) nv
                     JOIN wards w ON w.id = nv.ward_id GROUP BY w.name`),
      tx.execute(sql`SELECT w.name AS ward, count(*)::int AS voters FROM voters vt
                     JOIN wards w ON w.id = vt.ward_id WHERE vt.consent_withdrawn_at IS NULL GROUP BY w.name`),
      tx.execute(sql`SELECT w.name AS ward, count(*)::int AS members FROM people p
                     JOIN wards w ON w.id = p.ward_id WHERE p.active AND p.deleted_at IS NULL GROUP BY w.name`),
    ]);
    return {
      wardIds: wardRes as unknown as { id: string; name: string }[],
      sites: sitesRes as unknown as SiteRow[],
      polling: pollRes as unknown as { ward: string; stations: number; voters: number }[],
      villages: villRes as unknown as { ward: string; villages: number; reached: number; unvisited_names: string[] | null }[],
      voters: voterRes as unknown as { ward: string; voters: number }[],
      members: memberRes as unknown as { ward: string; members: number }[],
    };
  });
  const wardIdByName = new Map(data.wardIds.map((w) => [w.name, w.id]));

  // ── Static rosters & streams → per-ward maps ──────────────────────────────
  const waremboByWard = new Map<string, number>();
  for (const g of WAREMBO_ROSTER) waremboByWard.set(shortWard(g.ward), g.members.length);
  const flamesByWard = new Map<string, number>();
  for (const g of FLAMES_ROSTER) flamesByWard.set(shortWard(g.ward), g.members.length);

  const streamsByWard = new Map<string, { stations: number; streams: number }>();
  const stationList: { name: string; ward: string; streams: number; voters: number }[] = [];
  for (const s of Object.values(NYALI_POLLING_STREAMS)) {
    const voters = s.streams.reduce((a, n) => a + n, 0);
    stationList.push({ name: s.name, ward: s.ward, streams: s.streams.length, voters });
    const cur = streamsByWard.get(s.ward) ?? { stations: 0, streams: 0 };
    streamsByWard.set(s.ward, { stations: cur.stations + 1, streams: cur.streams + s.streams.length });
  }
  const topStations = [...stationList].sort((a, b) => b.voters - a.voters).slice(0, 8);

  // ── Site helpers ──────────────────────────────────────────────────────────
  const siteAgg = (ward: string, type: string) => {
    const r = data.sites.find((s) => s.ward === ward && s.type === type);
    return { total: r?.total ?? 0, visited: r?.visited ?? 0 };
  };
  const schoolTypes = ['school_primary', 'school_secondary', 'school_public', 'school_private', 'school_other', 'school_tertiary'];
  const schoolsIn = (ward: string) =>
    data.sites.filter((s) => s.ward === ward && schoolTypes.includes(s.type))
      .reduce((a, s) => ({ total: a.total + s.total, visited: a.visited + s.visited }), { total: 0, visited: 0 });

  const num = (m: { ward: string }[], ward: string, key: string) =>
    (m.find((r) => r.ward === ward) as any)?.[key] ?? 0;

  // ── Per-ward rollup ─────────────────────────────────────────────────────────
  const rows = WARD_ORDER.map((w) => {
    const mosque = siteAgg(w, 'mosque'), church = siteAgg(w, 'church'), boda = siteAgg(w, 'boda_stage');
    const school = schoolsIn(w);
    const sitesTotal = data.sites.filter((s) => s.ward === w).reduce((a, s) => a + s.total, 0);
    const sitesVisited = data.sites.filter((s) => s.ward === w).reduce((a, s) => a + s.visited, 0);
    const vRow = data.villages.find((v) => v.ward === w);
    return {
      ward: w, short: SHORT[w],
      id: wardIdByName.get(w) ?? '',
      unvisitedNames: (vRow?.unvisited_names ?? []).filter(Boolean),
      voters: num(data.voters, w, 'voters'),
      dbStations: num(data.polling, w, 'stations'),
      dbVoters: num(data.polling, w, 'voters'),
      stations: streamsByWard.get(w === "Ziwa La Ng'ombe" ? "Ziwa La Ng'ombe" : w)?.stations ?? 0,
      streams: streamsByWard.get(w)?.streams ?? 0,
      villages: num(data.villages, w, 'villages'),
      reached: num(data.villages, w, 'reached'),
      members: num(data.members, w, 'members'),
      warembo: waremboByWard.get(SHORT[w]) ?? 0,
      flames: flamesByWard.get(SHORT[w]) ?? 0,
      mosque, church, boda, school, sitesTotal, sitesVisited,
    };
  });

  // ── Constituency totals ─────────────────────────────────────────────────────
  const T = rows.reduce((a, r) => ({
    voters: a.voters + r.voters, stations: a.stations + r.dbStations, streams: a.streams + r.streams,
    villages: a.villages + r.villages, reached: a.reached + r.reached, members: a.members + r.members,
    warembo: a.warembo + r.warembo, flames: a.flames + r.flames, sites: a.sites + r.sitesTotal, visited: a.visited + r.sitesVisited,
  }), { voters: 0, stations: 0, streams: 0, villages: 0, reached: 0, members: 0, warembo: 0, flames: 0, sites: 0, visited: 0 });
  const visitedPct = T.sites ? (T.visited / T.sites) * 100 : 0;

  // Site-type composition (constituency)
  const typeTotals = new Map<string, number>();
  for (const s of data.sites) typeTotals.set(s.type, (typeTotals.get(s.type) ?? 0) + s.total);
  const groups = rows.map((r) => r.short);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/wards" className="text-xs font-semibold text-brand-aqua hover:text-brand-skyBlue">← Wards</Link>
        </div>
        <h1 className="text-2xl font-bold text-brand-textActive">📊 Constituency Coverage</h1>
        <p className="text-sm text-brand-textMuted">
          A full summary of all five Nyali wards — outreach, polling strength, village reach and team numbers.
        </p>
      </header>

      {/* ── HERO KPIs ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Registered voters" value={T.voters.toLocaleString()} tone={C.voters} />
        <Kpi label="Polling stations" value={T.stations} tone={C.teal} />
        <Kpi label="Polling streams" value={T.streams} tone={C.burnt} />
        <Kpi label="Villages" value={T.villages} tone={C.olive} sub={`${T.reached} reached`} />
        <Kpi label="Sites mapped" value={T.sites} tone={C.gold} sub={`${T.visited} visited`} />
        <Kpi label="Team members" value={T.members} tone={C.members} />
        <Kpi label="Warembo" value={T.warembo} tone={C.warembo} />
        <Kpi label="Alfayo Flames" value={T.flames} tone={C.flames} />
        <Kpi label="Site coverage" value={`${visitedPct.toFixed(0)}%`} tone={C.rust} />
      </section>

      {/* ── PER-WARD SUMMARY CARDS ─────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle emoji="🗺️" title="Ward-by-ward summary" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((r) => <WardCard key={r.ward} r={r} />)}
        </div>
      </section>

      {/* ── SITE VISITS: which ward visited most ───────────────────── */}
      <section className="space-y-4">
        <SectionTitle emoji="✅" title="Who's visited the most (by site type)" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RankPanel title="🕌 Mosques visited" color={C.mosque}
            bars={rows.map((r) => ({ label: r.short, value: r.mosque.visited, of: r.mosque.total }))} />
          <RankPanel title="🏍️ Boda stages visited" color={C.boda}
            bars={rows.map((r) => ({ label: r.short, value: r.boda.visited, of: r.boda.total }))} />
          <RankPanel title="⛪ Churches visited" color={C.church}
            bars={rows.map((r) => ({ label: r.short, value: r.church.visited, of: r.church.total }))} />
          <RankPanel title="🏫 Schools visited" color={C.school}
            bars={rows.map((r) => ({ label: r.short, value: r.school.visited, of: r.school.total }))} />
        </div>
        <ChartCard title="Sites visited vs mapped, per ward">
          <GroupedBarChart
            groups={groups}
            unit=" sites"
            series={[
              { label: 'Mapped', color: C.olive, values: rows.map((r) => r.sitesTotal) },
              { label: 'Visited', color: C.mosque, values: rows.map((r) => r.sitesVisited) },
            ]}
          />
        </ChartCard>
      </section>

      {/* ── POLLING & STREAMS ──────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle emoji="🗳️" title="Polling stations, streams & voters" />
        <ChartCard title="Polling stations & streams per ward">
          <GroupedBarChart
            groups={groups}
            series={[
              { label: 'Stations', color: C.teal, values: rows.map((r) => r.dbStations) },
              { label: 'Streams', color: C.burnt, values: rows.map((r) => r.streams) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Registered voters per ward">
          <GroupedBarChart
            groups={groups}
            unit=" voters"
            series={[{ label: 'Voters', color: C.voters, values: rows.map((r) => r.voters) }]}
            showLegend={false}
          />
        </ChartCard>
        <RankPanel title="🏆 Biggest polling stations (by registered voters)" color={C.teal}
          bars={topStations.map((s) => ({ label: s.name, value: s.voters, sub: `${shortWard(s.ward)} · ${s.streams} streams` }))}
          raw />
      </section>

      {/* ── VILLAGE REACH ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle emoji="📍" title="Village reach — where we've been, where we haven't" />
        <ChartCard title="Villages reached vs not yet visited, per ward">
          <GroupedBarChart
            groups={groups}
            unit=" villages"
            series={[
              { label: 'Reached', color: C.reached, values: rows.map((r) => r.reached) },
              { label: 'Not yet', color: C.notyet, values: rows.map((r) => r.villages - r.reached) },
            ]}
          />
        </ChartCard>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(() => {
            const best = [...rows].sort((a, b) => (b.reached / (b.villages || 1)) - (a.reached / (a.villages || 1)))[0];
            const worst = [...rows].sort((a, b) => (a.reached / (a.villages || 1)) - (b.reached / (b.villages || 1)))[0];
            const untouched = rows.reduce((a, r) => a + (r.villages - r.reached), 0);
            return (
              <>
                <MiniStat label="Best-covered ward" value={best.short} sub={`${best.reached}/${best.villages} villages`} tone={C.reached} />
                <MiniStat label="Needs attention" value={worst.short} sub={`only ${worst.reached}/${worst.villages} reached`} tone={C.rust} />
                <MiniStat label="Villages never visited" value={untouched} sub={`of ${T.villages} total`} tone={C.olive} />
              </>
            );
          })()}
        </div>
      </section>

      {/* ── TEAM STRENGTH ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle emoji="👥" title="Team strength per ward" />
        <ChartCard title="Members, Warembo & Alfayo Flames per ward">
          <GroupedBarChart
            groups={groups}
            series={[
              { label: 'Members', color: C.members, values: rows.map((r) => r.members) },
              { label: 'Warembo', color: C.warembo, values: rows.map((r) => r.warembo) },
              { label: 'Flames', color: C.flames, values: rows.map((r) => r.flames) },
            ]}
          />
        </ChartCard>
      </section>

      {/* ── SITE COMPOSITION ───────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle emoji="🧭" title="What's on the map (all sites)" />
        <div className="rounded-2xl border border-brand-border bg-brand-cardBg p-5 flex flex-wrap items-center justify-center gap-8">
          <Pie
            donut size={200}
            centerText={String(T.sites)} centerSubText="sites"
            data={[
              { label: 'Churches', value: typeTotals.get('church') ?? 0, color: C.church },
              { label: 'Boda stages', value: typeTotals.get('boda_stage') ?? 0, color: C.boda },
              { label: 'Mosques', value: typeTotals.get('mosque') ?? 0, color: C.mosque },
              { label: 'Schools', value: schoolTypes.reduce((a, t) => a + (typeTotals.get(t) ?? 0), 0), color: C.school },
              { label: 'Welfare / groups', value: (typeTotals.get('welfare_group') ?? 0) + (typeTotals.get('self_help_group') ?? 0) + (typeTotals.get('chama') ?? 0), color: C.olive },
            ]}
          />
        </div>
      </section>
    </div>
  );
}

// ── Presentational pieces ─────────────────────────────────────────────────────
function Kpi({ label, value, tone, sub }: { label: string; value: string | number; tone: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-3 text-center shadow-sm">
      <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: tone }}>{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">{label}</div>
      {sub && <div className="text-[10px] text-brand-textMuted">{sub}</div>}
    </div>
  );
}

function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-brand-border pb-2">
      <span className="text-lg">{emoji}</span>
      <h2 className="text-lg font-bold text-brand-textActive">{title}</h2>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-cardBg p-4">
      <div className="mb-2 text-sm font-bold text-brand-textActive">{title}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">{label}</div>
      <div className="mt-1 text-xl font-extrabold" style={{ color: tone }}>{value}</div>
      <div className="text-xs text-brand-textMuted">{sub}</div>
    </div>
  );
}

// Count-based ranking bars (labels show real counts, not %).
function RankPanel({
  title, color, bars, raw,
}: {
  title: string; color: string;
  bars: { label: string; value: number; of?: number; sub?: string }[];
  raw?: boolean;
}) {
  const max = Math.max(1, ...bars.map((b) => (raw ? b.value : (b.of ?? b.value))));
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-cardBg p-4">
      <div className="mb-3 text-sm font-bold text-brand-textActive">{title}</div>
      <div className="space-y-2.5">
        {sorted.map((b) => {
          const denom = raw ? max : (b.of ?? 0) || max;
          const pct = Math.max(3, (b.value / (denom || 1)) * 100);
          return (
            <div key={b.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-brand-textActive truncate pr-2">{b.label}</span>
                <span className="font-bold tabular-nums text-brand-textActive shrink-0">
                  {b.value}{b.of != null && <span className="text-brand-textMuted font-normal"> / {b.of}</span>}
                </span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-brand-cardBgHeavy/60 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              {b.sub && <div className="mt-0.5 text-[10px] text-brand-textMuted">{b.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WardCard({ r }: { r: any }) {
  const cov = r.sitesTotal ? Math.round((r.sitesVisited / r.sitesTotal) * 100) : 0;
  const neverVillages = r.villages - r.reached;
  const notVisited = r.sitesTotal - r.sitesVisited;
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-cardBg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/wards/${r.id}`} className="text-base font-bold text-brand-textActive hover:text-brand-burnt hover:underline">
          {r.ward}
        </Link>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: C.burnt }}>
          {cov}% sites visited
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Cell v={r.voters.toLocaleString()} l="Voters" />
        <Cell v={r.dbStations} l="Stations" />
        <Cell v={r.streams} l="Streams" />
        <Cell v={`${r.reached}/${r.villages}`} l="Villages reached" />
        <Cell v={r.members} l="Members" />
        <Cell v={`${r.warembo}+${r.flames}`} l="Warembo+Flames" />
      </div>
      <div className="space-y-1.5 pt-1">
        <TypeBar label="Mosques" a={r.mosque} color={C.mosque} />
        <TypeBar label="Churches" a={r.church} color={C.church} />
        <TypeBar label="Boda stages" a={r.boda} color={C.boda} />
        <TypeBar label="Schools" a={r.school} color={C.school} />
      </div>

      {/* Not-yet-reached — the gaps in this ward */}
      <div className="rounded-lg border border-brand-danger/25 bg-brand-danger/[0.04] p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.notyet }}>⚠ Not yet reached</span>
          <span className="text-[11px] text-brand-textMuted">{notVisited} sites · {neverVillages} villages left</span>
        </div>
        {r.unvisitedNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.unvisitedNames.slice(0, 8).map((n: string) => (
              <span key={n} className="rounded bg-brand-cardBgHeavy/60 px-1.5 py-0.5 text-[10px] text-brand-textBody">{n}</span>
            ))}
            {neverVillages > 8 && (
              <Link href={`/wards/${r.id}/villages`} className="rounded bg-brand-burnt/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-burnt hover:bg-brand-burnt hover:text-white">
                +{neverVillages - 8} more →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Links to the individual ward's comprehensive data */}
      <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold">
        <Link href={`/wards/${r.id}?tab=sites`} className="rounded-lg border border-brand-borderStrong px-3 py-1.5 text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt">
          Full ward coverage →
        </Link>
        <Link href={`/wards/${r.id}/villages`} className="rounded-lg border border-brand-borderStrong px-3 py-1.5 text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt">
          Villages →
        </Link>
        <Link href={`/wards/${r.id}?tab=stations`} className="rounded-lg border border-brand-borderStrong px-3 py-1.5 text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt">
          Polling →
        </Link>
      </div>
    </div>
  );
}
function Cell({ v, l }: { v: string | number; l: string }) {
  return (
    <div className="rounded-lg bg-brand-cardBgHeavy/50 py-1.5">
      <div className="text-sm font-extrabold text-brand-textActive tabular-nums">{v}</div>
      <div className="text-[9px] uppercase tracking-wide text-brand-textMuted">{l}</div>
    </div>
  );
}
function TypeBar({ label, a, color }: { label: string; a: { total: number; visited: number }; color: string }) {
  const pct = a.total ? (a.visited / a.total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-brand-textMuted">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-brand-cardBgHeavy/60 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, a.visited ? 4 : 0)}%`, backgroundColor: color }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] font-bold text-brand-textActive tabular-nums">
        {a.visited}<span className="text-brand-textMuted font-normal">/{a.total}</span>
      </span>
    </div>
  );
}
