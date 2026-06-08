import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql, eq, and, isNull, inArray, notInArray } from 'drizzle-orm';
import {
  communityLeaders,
  communitySites,
  people,
  pollingStations,
  villages,
  voters,
  wards,
} from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Pie } from '@/components/charts/pie';
import { HorizontalBarChart } from '@/components/charts/horizontal-bar';
import { PhoneActions } from '@/components/phone-actions';
import { WardLocatorMap } from '@/components/map/ward-locator-map';
import { AddWardMemberForm } from '@/components/add-ward-member-form';

// Ward detail page. Everything a ward coordinator needs at a glance:
//   - voter demographics (gender pie + youth share donut)
//   - polling stations + registered voter totals
//   - sites (mosques / churches / social) grouped by type, with visited toggle
//   - leaders
//   - quick phone actions on every record that has a phone

// SRS Note: youth band is 18-34 per Kenya National Youth Policy. Age band shown for the
// constituency-wide pie and per-ward; we compute age from date_of_birth at query time.

// ───────── Site type → tab mapping ─────────
// 6 tabs total: Coverage (overview) · Mosques · Churches · Social/Community · Boda · Other
// Coverage tab is special — it doesn't filter by type, it shows visited% donuts per
// category. All other tabs render the SiteCard list for their types.
type SiteTabKey = 'coverage' | 'mosques' | 'churches' | 'social' | 'boda' | 'other';

const SITE_TAB_DEF: Array<{ key: SiteTabKey; label: string; types: string[] }> = [
  { key: 'coverage', label: 'Coverage',                             types: [] /* aggregates everything */ },
  { key: 'mosques',  label: 'Mosques',                              types: ['mosque', 'madrasa'] },
  { key: 'churches', label: 'Churches',                             types: ['church'] },
  { key: 'social',   label: 'Social Halls & Community Centres',     types: ['social_hall', 'community_hall', 'youth_center', 'sports_club'] },
  { key: 'boda',     label: 'Boda Boda Centres',                    types: ['boda_stage'] },
  { key: 'other',    label: 'Other',                                types: ['matatu_stage', 'market', 'shopping_center', 'school_primary', 'school_secondary', 'school_other', 'chama', 'sacco', 'self_help_group', 'health_facility', 'government_office', 'other'] },
];

function tabKeyForType(t: string): SiteTabKey {
  // Coverage isn't a real category — it never matches a site type, but Other is the fallback.
  for (const tab of SITE_TAB_DEF) {
    if (tab.types.length > 0 && tab.types.includes(t)) return tab.key;
  }
  return 'other';
}

// ───────── Top-level tabs ─────────
type TopTab = 'demographics' | 'stations' | 'sites' | 'leaders' | 'itinerary';

interface PageProps {
  params: { id: string };
  searchParams: { cleaned?: string; merged?: string; deleted?: string; tab?: string; siteTab?: string };
}

export default async function WardDetail({ params, searchParams }: PageProps) {
  const claims = await getServerAuthOrRedirect();
  const wardId = params.id;
  const cleanedCount = Number(searchParams.cleaned ?? 0);  // legacy single-counter
  const mergedCount = Number(searchParams.merged ?? 0);
  const deletedCount = Number(searchParams.deleted ?? 0);
  const activeTab: TopTab = (['demographics', 'stations', 'sites', 'leaders', 'itinerary'].includes(searchParams.tab ?? '')
    ? searchParams.tab
    : 'sites') as TopTab;
  const activeSiteTab: SiteTabKey = (['coverage', 'mosques', 'churches', 'social', 'boda', 'other'].includes(searchParams.siteTab ?? '')
    ? searchParams.siteTab
    : 'coverage') as SiteTabKey;

  const data = await withRlsTx(claims, async (tx) => {
    const wardRows = await tx
      .select()
      .from(wards)
      .where(eq(wards.id, wardId))
      .limit(1);
    if (wardRows.length === 0) return null;
    const ward = wardRows[0]!;

    // Sibling wards for the breadcrumb quick-switcher — lets you hop across
    // wards without bouncing back to /wards. RLS handles visibility.
    const siblingWards = await tx
      .select({ id: wards.id, name: wards.name })
      .from(wards)
      .orderBy(wards.name);

    // Demographics aggregate. One query returns gender×age cross-tabs we need
    // for: gender pie · women share · men share · youth share · older-women share
    // · older-men share · age bands pie.
    const [demoRow] = await tx.execute(sql`
      SELECT
        COUNT(*)::int                                                                                   AS total,
        COUNT(*) FILTER (WHERE gender = 'M')::int                                                       AS men,
        COUNT(*) FILTER (WHERE gender = 'F')::int                                                       AS women,
        COUNT(*) FILTER (WHERE gender = 'U')::int                                                       AS unknown_gender,
        COUNT(*) FILTER (WHERE gender = 'M' AND date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 18 AND 34)::int  AS men_youth,
        COUNT(*) FILTER (WHERE gender = 'M' AND date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) >= 35)::int              AS men_older,
        COUNT(*) FILTER (WHERE gender = 'F' AND date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 18 AND 34)::int  AS women_youth,
        COUNT(*) FILTER (WHERE gender = 'F' AND date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) >= 35)::int              AS women_older,
        COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 18 AND 34)::int                   AS youth,
        COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 35 AND 59)::int                   AS mid,
        COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) >= 60)::int                               AS senior,
        COUNT(*) FILTER (WHERE date_of_birth IS NULL)::int                                                                                   AS age_unknown,
        COUNT(*) FILTER (WHERE phone IS NOT NULL)::int                                                                                       AS with_phone
      FROM ${voters}
      WHERE ${voters.wardId} = ${wardId}::uuid
        AND ${voters.consentWithdrawnAt} IS NULL
    `) as any[];

    // Voter count per polling station (for the station-distribution bar).
    const stationVoterCounts = await tx
      .select({ pid: voters.pollingStationId, c: sql<number>`count(*)::int` })
      .from(voters)
      .where(eq(voters.wardId, wardId))
      .groupBy(voters.pollingStationId);

    const stations = await tx
      .select()
      .from(pollingStations)
      .where(and(eq(pollingStations.wardId, wardId), eq(pollingStations.active, true)))
      .orderBy(pollingStations.iebcCode);

    const sites = await tx
      .select()
      .from(communitySites)
      .where(and(eq(communitySites.wardId, wardId), isNull(communitySites.deletedAt)))
      .orderBy(communitySites.type, communitySites.name);

    const leaders = await tx
      .select()
      .from(communityLeaders)
      .where(and(eq(communityLeaders.wardId, wardId), isNull(communityLeaders.deletedAt)))
      .orderBy(communityLeaders.fullName);

    // Villages in this ward — to group community leaders under their village.
    const villageRows = await tx
      .select({ id: villages.id, name: villages.name })
      .from(villages)
      .where(and(eq(villages.wardId, wardId), isNull(villages.deletedAt)))
      .orderBy(villages.name);

    // Person in charge — the ward coordinator(s) + assistants for THIS ward.
    const wardTeam = await tx
      .select({
        id: people.id,
        fullName: people.fullName,
        role: people.role,
        title: people.title,
        phone: people.phone,
        photoUrl: people.photoUrl,
      })
      .from(people)
      .where(and(
        eq(people.wardId, wardId),
        eq(people.active, true),
        isNull(people.deletedAt),
        inArray(people.role, ['ward_coordinator', 'assistant_ward_coordinator']),
      ));

    // Other campaign team members assigned to this ward (not the coordinators).
    const wardMembers = await tx
      .select({ id: people.id, fullName: people.fullName, role: people.role, title: people.title, phone: people.phone })
      .from(people)
      .where(and(
        eq(people.wardId, wardId),
        eq(people.active, true),
        isNull(people.deletedAt),
        notInArray(people.role, ['ward_coordinator', 'assistant_ward_coordinator']),
      ))
      .orderBy(people.fullName);

    return { ward, demo: demoRow ?? null, stationVoterCounts, stations, sites, leaders, villageRows, wardTeam, wardMembers, siblingWards };
  });

  if (!data) notFound();

  const { ward, demo, stationVoterCounts, stations, sites, leaders, villageRows, wardTeam, wardMembers, siblingWards } = data;
  const wardCoordinator = wardTeam.find((t) => t.role === 'ward_coordinator') ?? null;
  const wardAssistants = wardTeam.filter((t) => t.role === 'assistant_ward_coordinator');

  const totalVoters = Number(demo?.total ?? 0);
  const totalMen = Number(demo?.men ?? 0);
  const totalWomen = Number(demo?.women ?? 0);
  const totalUnknown = Number(demo?.unknown_gender ?? 0);
  const menYouth = Number(demo?.men_youth ?? 0);
  const menOlder = Number(demo?.men_older ?? 0);
  const womenYouth = Number(demo?.women_youth ?? 0);
  const womenOlder = Number(demo?.women_older ?? 0);
  const totalYouth = Number(demo?.youth ?? 0);
  const totalMid = Number(demo?.mid ?? 0);
  const totalSenior = Number(demo?.senior ?? 0);
  const totalAgeUnknown = Number(demo?.age_unknown ?? 0);
  const withPhone = Number(demo?.with_phone ?? 0);

  const pct = (n: number) => (totalVoters > 0 ? (n / totalVoters) * 100 : 0);
  const womenPct      = pct(totalWomen);
  const menPct        = pct(totalMen);
  const youthPct      = pct(totalYouth);
  const womenOlderPct = pct(womenOlder);
  const menOlderPct   = pct(menOlder);
  const phonePct      = pct(withPhone);

  // Sites: visit-coverage donut + per-tab counts.
  const sitesVisited = sites.filter((s) => s.visited).length;
  const tabCounts = SITE_TAB_DEF.reduce<Record<SiteTabKey, { total: number; visited: number }>>((acc, t) => {
    acc[t.key] = { total: 0, visited: 0 };
    return acc;
  }, { coverage: { total: 0, visited: 0 }, mosques: { total: 0, visited: 0 }, churches: { total: 0, visited: 0 }, social: { total: 0, visited: 0 }, boda: { total: 0, visited: 0 }, other: { total: 0, visited: 0 } });
  for (const s of sites) {
    const k = tabKeyForType(s.type);
    tabCounts[k].total++;
    if (s.visited) tabCounts[k].visited++;
  }
  const sitesInActiveTab = sites.filter((s) => tabKeyForType(s.type) === activeSiteTab);
  const visitedPct = sites.length > 0 ? (sitesVisited / sites.length) * 100 : 0;
  const sitesByType: Record<string, typeof sites> = {};
  for (const s of sites) {
    (sitesByType[s.type] ??= []).push(s);
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <Breadcrumbs
        items={[
          { label: 'Wards', href: '/wards' },
          {
            label: ward.name,
            siblings: siblingWards.map((w) => ({
              label: w.name,
              href: `/wards/${w.id}`,
              current: w.id === ward.id,
            })),
          },
        ]}
      />
      <header className="space-y-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-extrabold text-brand-textActive">{ward.name}</h1>
            <span className="text-sm text-brand-textMuted">Nyali Constituency</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/wards/${ward.id}/voters`}
              className="rounded-md bg-brand-orangeBright px-3 py-2 text-xs font-semibold text-white hover:bg-brand-orangeAlt"
            >
              🔍 Search voters in {ward.name}
            </Link>
            <Link
              href={`/wards/${ward.id}/import?entity=voters`}
              className="rounded-md bg-brand-tealBlue px-3 py-2 text-xs font-semibold text-white hover:bg-brand-tealBright"
            >
              + Add IEBC voter register
            </Link>
            <Link
              href={`/wards/${ward.id}/import?entity=sites`}
              className="rounded-md border border-brand-border px-3 py-2 text-xs font-semibold text-brand-textActive hover:border-brand-tealBlue"
            >
              + Add sites
            </Link>
          </div>
        </div>
        <p className="text-sm text-brand-textMuted">
          {(ward.registeredVoters ?? 0).toLocaleString()} registered voters · {stations.length} polling stations · {sites.length} sites · {leaders.length} leaders
        </p>
      </header>

      {(mergedCount > 0 || deletedCount > 0 || cleanedCount > 0) && (
        <div className="rounded-lg border border-brand-success/40 bg-brand-success/10 px-4 py-2 text-sm text-brand-success space-y-0.5">
          {mergedCount > 0 && (
            <div>
              ✓ Merged {mergedCount} polling station{mergedCount === 1 ? '' : 's'} —
              seed stations absorbed their auto-created twin (voters moved over, IEBC
              code + turnout history preserved).
            </div>
          )}
          {deletedCount > 0 && (
            <div>
              ✓ Removed {deletedCount} duplicate{deletedCount === 1 ? '' : 's'} with no voters and no fuzzy match.
            </div>
          )}
          {cleanedCount > 0 && mergedCount === 0 && deletedCount === 0 && (
            <div>
              ✓ Removed {cleanedCount} duplicate polling station{cleanedCount === 1 ? '' : 's'} with no voters linked.
            </div>
          )}
        </div>
      )}

      {/* Ward leadership — shown ABOVE the tabs so it's the first thing you see. */}
      {wardCoordinator && (
        <section className="rounded-xl border border-brand-burnt/40 bg-brand-burnt/5 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-burnt mb-3">
            ★ Ward Leadership — {ward.name}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CoordinatorCard person={wardCoordinator} primary />
            {wardAssistants.map((a) => (
              <CoordinatorCard key={a.id} person={a} primary={false} />
            ))}
          </div>
        </section>
      )}

      {/* TOP-LEVEL TABS — horizontal-scroll strip (clean on phones) */}
      <nav className="flex gap-1 border-b border-brand-border overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={`/wards/${ward.id}?tab=sites`}
          className={[
            'px-5 py-3 text-base sm:text-lg font-bold uppercase tracking-wide border-b-[3px] -mb-px transition whitespace-nowrap shrink-0',
            activeTab === 'sites'
              ? 'border-brand-orangeBright text-brand-textActive'
              : 'border-transparent text-brand-textMuted hover:text-brand-textActive hover:border-brand-border',
          ].join(' ')}
        >
          Religious &amp; social sites <span className="ml-1 text-xs opacity-75">({sites.length})</span>
        </Link>
        <Link
          href={`/wards/${ward.id}?tab=leaders`}
          className={[
            'px-5 py-3 text-base sm:text-lg font-bold uppercase tracking-wide border-b-[3px] -mb-px transition whitespace-nowrap shrink-0',
            activeTab === 'leaders'
              ? 'border-brand-orangeBright text-brand-textActive'
              : 'border-transparent text-brand-textMuted hover:text-brand-textActive hover:border-brand-border',
          ].join(' ')}
        >
          Community leaders <span className="ml-1 text-xs opacity-75">({leaders.length})</span>
        </Link>
        <Link
          href={`/wards/${ward.id}?tab=itinerary`}
          className={[
            'px-5 py-3 text-base sm:text-lg font-bold uppercase tracking-wide border-b-[3px] -mb-px transition whitespace-nowrap shrink-0',
            activeTab === 'itinerary'
              ? 'border-brand-orangeBright text-brand-textActive'
              : 'border-transparent text-brand-textMuted hover:text-brand-textActive hover:border-brand-border',
          ].join(' ')}
        >
          📅 Itinerary &amp; meetings
        </Link>
      </nav>


      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Demographics & station size                                     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'demographics' && (<>

      {/* DEMOGRAPHICS — 8 cards, 2 rows (gender focus / age focus) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
            Demographics ({totalVoters.toLocaleString()} voters)
          </h2>
          <p className="text-xs text-brand-textMuted">
            Live from the imported IEBC voter list. Older = 35+. Youth = 18-34 per Kenya
            National Youth Policy.
          </p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <DonutCard title="Gender split">
            <Pie
              size={140}
              data={[
                { label: 'Men',     value: totalMen,     color: '#00ccff' },
                { label: 'Women',   value: totalWomen,   color: '#ff6600' },
                { label: 'Unknown', value: totalUnknown, color: '#64748b' },
              ]}
            />
          </DonutCard>

          <DonutCard title="Youth share (18-34)">
            <Pie
              donut
              size={140}
              centerText={`${youthPct.toFixed(0)}%`}
              centerSubText={`${totalYouth.toLocaleString()}`}
              data={[
                { label: 'Youth (18-34)',  value: totalYouth,                  color: '#00ccff' },
                { label: '35 and over',    value: totalMid + totalSenior,      color: '#025e73' },
                { label: 'Age unknown',    value: totalAgeUnknown,             color: '#64748b' },
              ]}
            />
          </DonutCard>

          <DonutCard title="Men share">
            <Pie
              donut
              size={140}
              centerText={`${menPct.toFixed(0)}%`}
              centerSubText={`${totalMen.toLocaleString()}`}
              data={[
                { label: 'Men',   value: totalMen,                 color: '#00ccff' },
                { label: 'Other', value: totalVoters - totalMen,   color: '#1f3640' },
              ]}
            />
          </DonutCard>

          <DonutCard title="Women share">
            <Pie
              donut
              size={140}
              centerText={`${womenPct.toFixed(0)}%`}
              centerSubText={`${totalWomen.toLocaleString()}`}
              data={[
                { label: 'Women', value: totalWomen,                 color: '#ff6600' },
                { label: 'Other', value: totalVoters - totalWomen,   color: '#1f3640' },
              ]}
            />
          </DonutCard>
        </div>
      </section>

      {/* STATION DISTRIBUTION — horizontal bar of voters per station */}
      {stations.length > 0 && totalVoters > 0 && (() => {
        const countByStation = new Map<string, number>();
        for (const r of stationVoterCounts) if (r.pid) countByStation.set(r.pid, r.c);
        const ranked = stations
          .map((s) => ({ ...s, voterCount: countByStation.get(s.id) ?? 0 }))
          .sort((a, b) => b.voterCount - a.voterCount);
        const maxCount = ranked[0]?.voterCount ?? 0;
        return (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Polling stations by size
              </h2>
              <p className="text-xs text-brand-textMuted">
                Where this ward's voters are concentrated. Bigger bars = bigger turnout-protection priority.
              </p>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4 max-w-3xl">
              <HorizontalBarChart
                max={maxCount}
                bars={ranked.map((s, i) => ({
                  label: s.name,
                  value: s.voterCount,
                  color: i === 0 ? '#ff6600' : i < 3 ? '#00ccff' : '#025e73',
                  sublabel: `${s.iebcCode} · ${s.voterCount.toLocaleString()} voters`,
                  highlight: i === 0,
                }))}
                showValue={false}
              />
            </div>
          </section>
        );
      })()}

      </>)}{/* end TAB: demographics */}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Polling stations                                                */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'stations' && (<>

      {/* Locator — click another ward to jump to ITS polling stations */}
      <WardLocatorMap wardId={ward.id} hrefTab="stations" className="max-w-lg mx-auto" />

      {/* POLLING STATIONS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
            Polling stations ({stations.length})
          </h2>
          <form action="/api/polling-stations/dedup" method="post">
            <input type="hidden" name="wardId" value={ward.id} />
            <button
              type="submit"
              className="text-[11px] font-semibold text-brand-textMuted hover:text-brand-orangeBright"
              title="Merge seed stations with their auto-created twins (preserving IEBC code + turnout history) and delete any stations with no voters AND no fuzzy match."
            >
              ⚙ Merge &amp; clean up duplicates
            </button>
          </form>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {stations.map((s) => (
            <Link
              key={s.id}
              href={`/polling-stations/${s.id}`}
              className="group block rounded-lg border border-brand-border bg-brand-cardBg p-3 hover:border-brand-tealBlue hover:shadow-brand-teal transition"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-semibold text-brand-textActive truncate">{s.name}</div>
                <span className="text-[10px] font-mono text-brand-textMuted shrink-0">{s.iebcCode}</span>
              </div>
              <div className="text-xs text-brand-textMuted">
                {s.registeredVoters.toLocaleString()} registered
                {s.turnout2022 !== null && <> · 2022 turnout {s.turnout2022}%</>}
              </div>
              <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-tealBlue/15 text-brand-skyBlue text-[10px] font-bold uppercase tracking-wider group-hover:bg-brand-tealBlue group-hover:text-white transition">
                View voters →
              </div>
            </Link>
          ))}
          {stations.length === 0 && (
            <div className="col-span-full text-sm text-brand-textMuted italic">
              No stations for this ward yet — import voters and stations will be auto-created from their POLLING STATION column.
            </div>
          )}
        </div>
      </section>

      </>)}{/* end TAB: stations */}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Religious & social sites                                        */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'sites' && (<>

      {/* SITES — tabbed by category */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
            Religious &amp; social sites ({sites.length})
          </h2>
          {sites.length > 0 && (
            <span className="text-xs text-brand-textMuted">
              <span className="text-brand-success font-semibold">{sitesVisited}</span> of {sites.length} visited ({visitedPct.toFixed(0)}%)
            </span>
          )}
        </div>

        {/* Tab nav */}
        <nav className="flex flex-wrap gap-1 border-b border-brand-border">
          {SITE_TAB_DEF.map((t) => {
            const counts = tabCounts[t.key];
            const isActive = activeSiteTab === t.key;
            // Coverage tab badge shows total sites in the ward; others show visited/total.
            const badge = t.key === 'coverage'
              ? sites.length.toString()
              : `${counts.visited}/${counts.total}`;
            return (
              <Link
                key={t.key}
                href={`/wards/${ward.id}?tab=sites&siteTab=${t.key}`}
                className={[
                  'px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition whitespace-nowrap',
                  isActive
                    ? 'border-brand-orangeBright text-brand-textActive'
                    : 'border-transparent text-brand-textMuted hover:text-brand-textActive hover:border-brand-border',
                ].join(' ')}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] opacity-80">{badge}</span>
              </Link>
            );
          })}
        </nav>

        {/* COVERAGE tab — pies per category */}
        {activeSiteTab === 'coverage' && (
          sites.length === 0 ? (
            <div className="text-sm text-brand-textMuted italic py-4 text-center">
              No sites in this ward yet.
              <br />
              <Link href={`/wards/${ward.id}/import?entity=sites`} className="text-brand-orangeBright hover:underline mt-1 inline-block">
                + Add via Data Import → Sites
              </Link>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Overall coverage hero */}
              <div className="rounded-xl border border-brand-border bg-brand-cardBg p-5 flex flex-col items-center">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-2 text-center">
                  Total outreach coverage ({sites.length} sites)
                </h3>
                <Pie
                  donut
                  size={170}
                  centerText={`${visitedPct.toFixed(0)}%`}
                  centerSubText={`${sitesVisited} of ${sites.length}`}
                  data={[
                    { label: 'Visited',     value: sitesVisited,                  color: '#10b981' },
                    { label: 'Not visited', value: sites.length - sitesVisited,   color: '#ef4444' },
                  ]}
                />
              </div>

              {/* Per-category coverage donuts — Mosques / Churches / Social / Boda */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SITE_TAB_DEF.filter((t) => t.key !== 'coverage' && t.key !== 'other').map((t) => {
                  const c = tabCounts[t.key];
                  const pct = c.total > 0 ? (c.visited / c.total) * 100 : 0;
                  return (
                    <Link
                      key={t.key}
                      href={`/wards/${ward.id}?tab=sites&siteTab=${t.key}`}
                      className="rounded-xl border border-brand-border bg-brand-cardBg p-4 hover:border-brand-orangeBright transition flex flex-col items-center"
                    >
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-2 text-center">
                        {t.label}
                      </h3>
                      {c.total > 0 ? (
                        <Pie
                          donut
                          size={130}
                          centerText={`${pct.toFixed(0)}%`}
                          centerSubText={`${c.visited}/${c.total}`}
                          data={[
                            { label: 'Visited',     value: c.visited,             color: '#10b981' },
                            { label: 'Not visited', value: c.total - c.visited,   color: '#ef4444' },
                          ]}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center w-[130px] h-[130px]">
                          <span className="text-xs text-brand-textMuted italic">No sites</span>
                          <span className="text-[10px] text-brand-textMuted/70 mt-1">add via + Add sites</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* "Other" coverage card (smaller, only if non-empty) */}
              {tabCounts.other.total > 0 && (
                <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">
                      Other sites (markets, schools, chamas, …)
                    </h3>
                    <Link href={`/wards/${ward.id}?tab=sites&siteTab=other`} className="text-[10px] text-brand-orangeBright hover:underline">
                      View →
                    </Link>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] uppercase tracking-wider text-brand-textMuted">
                        <span>Visited</span>
                        <span>{tabCounts.other.visited}/{tabCounts.other.total} ({(tabCounts.other.total > 0 ? (tabCounts.other.visited / tabCounts.other.total) * 100 : 0).toFixed(0)}%)</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-black/10 overflow-hidden">
                        <div className="h-full bg-brand-success"
                             style={{ width: `${tabCounts.other.total > 0 ? (tabCounts.other.visited / tabCounts.other.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* Per-category SiteCard list (any tab other than coverage) */}
        {activeSiteTab !== 'coverage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {sitesInActiveTab.map((s) => (
              <SiteCard key={s.id} site={s} />
            ))}
            {sitesInActiveTab.length === 0 && (
              <div className="col-span-full text-sm text-brand-textMuted italic py-4 text-center">
                No {SITE_TAB_DEF.find((t) => t.key === activeSiteTab)?.label.toLowerCase()} in this ward yet.
                <br />
                <Link href={`/wards/${ward.id}/import?entity=sites`} className="text-brand-orangeBright hover:underline mt-1 inline-block">
                  + Add via Data Import → Sites
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      </>)}{/* end TAB: sites */}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Itinerary & meetings                                            */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'itinerary' && (
        <ItineraryTab ward={ward} sites={sites} />
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Community leaders (grouped by village)                          */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'leaders' && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-brand-border pb-1">
            <h2 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
              Community Leaders ({leaders.length})
            </h2>
            <span className="text-xs text-brand-textMuted">Chiefs · Elders · Community Leaders</span>
          </div>

          {leaders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-borderStrong bg-brand-cardBg/40 p-8 text-center text-sm text-brand-textMuted">
              No leaders for this ward yet — add them on the Community Leaders page.
            </div>
          ) : (
            (() => {
              // Three role-based groups, not one long list.
              const isChief = (r: string) => /chief/i.test(r);
              const isElder = (r: string) => /elder/i.test(r);
              const groups = [
                { name: 'Chiefs', list: leaders.filter((l) => isChief(l.roleTitle)) },
                { name: 'Elders', list: leaders.filter((l) => isElder(l.roleTitle)) },
                { name: 'Community Leaders', list: leaders.filter((l) => !isChief(l.roleTitle) && !isElder(l.roleTitle)) },
              ].filter((g) => g.list.length > 0);
              return groups.map((g) => (
                <div key={g.name} className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
                  {/* Village sub-group header */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-brand-burnt/10 border-b border-brand-border">
                    <h3 className="text-xs font-extrabold text-brand-burnt uppercase tracking-wide truncate">{g.name}</h3>
                    <span className="shrink-0 text-[10px] font-bold text-brand-burnt">
                      {g.list.length}
                    </span>
                  </div>
                  {/* Compact leader rows — dense so a whole ward fits on screen */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                    {g.list.map((l) => {
                      const initials = l.fullName.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
                      return (
                        <div key={l.id} className="flex items-center gap-2 px-2.5 py-1.5 border-b border-r border-brand-border/30 hover:bg-black/[0.03] transition">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-brand-teal/15 text-brand-teal flex items-center justify-center text-[9px] font-bold">
                            {initials}
                          </span>
                          <div className="min-w-0 flex-1 leading-tight">
                            <div className="text-[12px] font-semibold text-brand-textActive truncate">{l.fullName}</div>
                            <div className="text-[10px] text-brand-textMuted truncate">
                              {l.roleTitle}{l.phone ? ` · ${l.phone}` : ''}
                            </div>
                          </div>
                          {l.phone && <PhoneActions phone={l.phone} size="sm" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()
          )}

          {/* Ward Members — campaign team in this ward (added below). */}
          <div className="pt-4 space-y-2">
            <div className="relative flex items-baseline justify-between border-b border-brand-border pb-1">
              <h2 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Ward Members ({wardMembers.length})
              </h2>
              <AddWardMemberForm wardId={ward.id} wardName={ward.name} />
            </div>
            {wardMembers.length === 0 ? (
              <p className="text-sm text-brand-textMuted italic">No ward members added yet — use “+ Add member”.</p>
            ) : (
              <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {wardMembers.map((m) => {
                  const initials = m.fullName.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
                  return (
                    <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 border-b border-r border-brand-border/30">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-brand-olive/20 text-brand-olive flex items-center justify-center text-[9px] font-bold">{initials}</span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="text-[12px] font-semibold text-brand-textActive truncate">{m.fullName}</div>
                        <div className="text-[10px] text-brand-textMuted truncate">{m.title || ROLE_LABEL_WARD[m.role] || m.role}{m.phone ? ` · ${m.phone}` : ''}</div>
                      </div>
                      {m.phone && <PhoneActions phone={m.phone} size="sm" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

    </div>
  );
}

const ROLE_LABEL_WARD: Record<string, string> = {
  canvasser: 'Canvasser',
  polling_agent: 'Polling Agent',
  polling_station_lead: 'Polling Station Lead',
  influence_liaison: 'Mobiliser',
};

function ItineraryTab({ ward, sites }: { ward: any; sites: any[] }) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const planned = sites
    .filter((s) => s.plannedVisitAt && !s.visited)
    .map((s) => ({ ...s, _at: new Date(s.plannedVisitAt) }))
    .sort((a, b) => a._at.getTime() - b._at.getTime());

  const completed = sites
    .filter((s) => s.visited && s.visitedAt)
    .map((s) => ({ ...s, _at: new Date(s.visitedAt) }))
    .sort((a, b) => b._at.getTime() - a._at.getTime())
    .slice(0, 50);

  const today = planned.filter((p) => p._at >= todayStart && p._at < todayEnd);
  const upcoming = planned.filter((p) => p._at >= todayEnd);
  const overdue = planned.filter((p) => p._at < todayStart);

  // Temperature + recommendation breakdown across completed visits.
  const tempCounts = { hot: 0, warm: 0, cold: 0, unknown: 0 };
  const recoCounts = { high_priority: 0, normal: 0, low_priority: 0, unknown: 0 };
  for (const c of completed) {
    const t = c.visitTemperature as keyof typeof tempCounts;
    if (t && t in tempCounts) tempCounts[t]++; else tempCounts.unknown++;
    const r = c.visitRecommendation as keyof typeof recoCounts;
    if (r && r in recoCounts) recoCounts[r]++; else recoCounts.unknown++;
  }

  function fmt(d: Date) {
    return d.toLocaleDateString('en-KE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="space-y-5">
      {/* TODAY notification banner */}
      {today.length > 0 && (
        <div className="rounded-xl border border-brand-orangeBright/50 bg-brand-orangeBright/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-brand-orangeBright">
            <span className="text-lg">🔔</span>
            <span className="text-xs font-bold uppercase tracking-wider">
              You have {today.length} visit{today.length === 1 ? '' : 's'} scheduled for today
            </span>
          </div>
          <ul className="space-y-1 text-sm text-brand-textBody">
            {today.map((p) => (
              <li key={p.id} className="flex items-baseline gap-2">
                <span className="text-brand-orangeBright">●</span>
                <span className="font-semibold text-brand-textActive">{p.name}</span>
                {p.areaName && <span className="text-xs text-brand-textMuted">· {p.areaName}</span>}
                {p.contactPersonName && <span className="text-xs text-brand-textMuted">· {p.contactPersonName}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* OVERDUE — past-due planned visits */}
      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-brand-danger">
            ⚠ Overdue plans ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((p) => (
              <PlannedRow key={p.id} ward={ward} site={p} when={fmt(p._at)} tone="danger" />
            ))}
          </div>
        </section>
      )}

      {/* UPCOMING */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-textActive">
          📅 Upcoming planned visits ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <div className="text-sm text-brand-textMuted italic rounded-lg border border-brand-border bg-brand-cardBg/40 p-3">
            No upcoming visits scheduled. Plan visits from the Sites tab → site card → "Plan a future visit".
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((p) => (
              <PlannedRow key={p.id} ward={ward} site={p} when={fmt(p._at)} tone="amber" />
            ))}
          </div>
        )}
      </section>

      {/* TEMPERATURE / RECOMMENDATION SUMMARY */}
      {completed.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-textMuted mb-2">
              Welcome temperature ({completed.length} visits)
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="🔥 Hot"  value={tempCounts.hot}  color="text-rose-300" />
              <Stat label="🌤 Warm" value={tempCounts.warm} color="text-amber-300" />
              <Stat label="🧊 Cold" value={tempCounts.cold} color="text-sky-300" />
            </div>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-textMuted mb-2">
              Revisit recommendations
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="★ Priority" value={recoCounts.high_priority} color="text-brand-orangeBright" />
              <Stat label="Normal"     value={recoCounts.normal}        color="text-brand-skyBlue" />
              <Stat label="Low"        value={recoCounts.low_priority}  color="text-brand-textMuted" />
            </div>
          </div>
        </section>
      )}

      {/* COMPLETED */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-textActive">
          ✓ Recent completed visits ({completed.length})
        </h2>
        {completed.length === 0 ? (
          <div className="text-sm text-brand-textMuted italic rounded-lg border border-brand-border bg-brand-cardBg/40 p-3">
            No visits logged yet. Log completed visits from the Sites tab → site card → "Log a completed visit".
          </div>
        ) : (
          <div className="space-y-2">
            {completed.map((c) => (
              <CompletedRow key={c.id} ward={ward} site={c} when={fmt(c._at)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PlannedRow({ ward, site, when, tone }: { ward: any; site: any; when: string; tone: 'amber' | 'danger' }) {
  const accent = tone === 'danger' ? 'border-l-brand-danger' : 'border-l-amber-500';
  const txt = tone === 'danger' ? 'text-brand-danger' : 'text-amber-300';
  return (
    <Link
      href={`/wards/${ward.id}?tab=sites&siteTab=${tabKeyForType(site.type)}`}
      className={`block rounded-lg border border-brand-border border-l-4 ${accent} bg-brand-cardBg p-3 hover:border-brand-orangeBright transition`}
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-brand-textActive">{site.name}</div>
          <div className="text-[10px] text-brand-textMuted">
            {site.areaName && <>📍 {site.areaName} · </>}
            {site.contactPersonName && <>{site.contactRole ? `${site.contactRole} ` : ''}{site.contactPersonName}</>}
          </div>
        </div>
        <div className={`text-xs font-bold ${txt}`}>{when}</div>
      </div>
      {site.plannedPurpose && (
        <div className="mt-1.5 text-xs text-brand-textBody">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">Purpose: </span>
          {site.plannedPurpose.length > 140 ? site.plannedPurpose.slice(0, 140) + '…' : site.plannedPurpose}
        </div>
      )}
    </Link>
  );
}

function CompletedRow({ ward, site, when }: { ward: any; site: any; when: string }) {
  const temp = site.visitTemperature as 'hot' | 'warm' | 'cold' | null;
  const reco = site.visitRecommendation as 'high_priority' | 'normal' | 'low_priority' | null;
  return (
    <Link
      href={`/wards/${ward.id}?tab=sites&siteTab=${tabKeyForType(site.type)}`}
      className="block rounded-lg border border-brand-border border-l-4 border-l-emerald-500 bg-brand-cardBg p-3 hover:border-brand-orangeBright transition"
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-brand-textActive">{site.name}</div>
          <div className="text-[10px] text-brand-textMuted">
            {site.areaName && <>📍 {site.areaName} · </>}
            {site.contactPersonName && <>{site.contactRole ? `${site.contactRole} ` : ''}{site.contactPersonName}</>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {temp && <TempBadge temp={temp} />}
          {reco && <RecoBadge reco={reco} />}
          <div className="text-xs font-bold text-emerald-300">{when}</div>
        </div>
      </div>
      {site.visitNotes && (
        <div className="mt-1.5 text-xs text-brand-textBody">
          {site.visitNotes.length > 140 ? site.visitNotes.slice(0, 140) + '…' : site.visitNotes}
        </div>
      )}
    </Link>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted">{label}</div>
    </div>
  );
}

function CoordinatorCard({
  person,
  primary,
}: {
  person: { id: string; fullName: string; title: string | null; phone: string; photoUrl?: string | null; role: string };
  primary: boolean;
}) {
  const initials = person.fullName.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const roleLabel = person.role === 'ward_coordinator' ? 'Ward Representative' : 'Assistant Ward Rep';
  return (
    <div className={[
      'rounded-lg border bg-brand-cardBg p-3 space-y-2',
      primary ? 'border-brand-burnt/60' : 'border-brand-border',
    ].join(' ')}>
      <div className="flex items-start gap-3">
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photoUrl} alt={person.fullName} className="w-16 h-16 rounded-full object-cover border-2 border-brand-burnt/40 shrink-0" />
        ) : (
          <div className={[
            'w-16 h-16 rounded-full border-2 flex items-center justify-center text-lg font-bold shrink-0',
            primary
              ? 'bg-brand-burnt/15 border-brand-burnt/40 text-brand-burnt'
              : 'bg-brand-teal/10 border-brand-teal/40 text-brand-teal',
          ].join(' ')}>
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-brand-textActive truncate">{person.fullName}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-burnt">
            {roleLabel}
          </div>
          {person.title && (
            <div className="text-[10px] text-brand-textMuted truncate">{person.title}</div>
          )}
          <div className="text-[10px] text-brand-textMuted font-mono mt-0.5">{person.phone}</div>
        </div>
        <div className="shrink-0">
          <PhoneActions phone={person.phone} size="sm" />
        </div>
      </div>

      {/* Inline photo upload — redirects back here on save. */}
      <details className="text-xs">
        <summary className="cursor-pointer text-brand-textMuted hover:text-brand-burnt select-none list-none flex items-center gap-1 border-t border-brand-border/40 pt-1.5">
          <span className="text-[10px]">▾</span>
          <span>{person.photoUrl ? '📷 Change photo' : '📷 Add photo'}</span>
        </summary>
        <form
          action={`/api/team/${person.id}/photo`}
          method="post"
          encType="multipart/form-data"
          className="mt-2 space-y-2 bg-black/5 rounded-lg p-2"
        >
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-[11px] text-brand-textActive file:mr-2 file:rounded file:border-0 file:bg-brand-burnt file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-white hover:file:bg-brand-rust"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-burnt px-3 py-1 text-[10px] font-semibold text-white hover:bg-brand-rust"
          >
            Save photo
          </button>
        </form>
      </details>
    </div>
  );
}

function DonutCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4 flex flex-col items-center">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-2 text-center">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SiteCard({ site }: { site: any }) {
  const visited = !!site.visited;
  const visitedAt = site.visitedAt ? new Date(site.visitedAt) : null;
  const plannedAt = site.plannedVisitAt ? new Date(site.plannedVisitAt) : null;
  const visitedDateLong = visitedAt
    ? visitedAt.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const plannedDateLong = plannedAt
    ? plannedAt.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const visitedIso = visitedAt ? visitedAt.toISOString().slice(0, 10) : '';
  const plannedIso = plannedAt ? plannedAt.toISOString().slice(0, 10) : '';
  const today = new Date().toISOString().slice(0, 10);
  const notePreview = (site.visitNotes ?? '').toString().trim();
  const temp = (site.visitTemperature ?? '') as '' | 'hot' | 'warm' | 'cold';
  const reco = (site.visitRecommendation ?? '') as '' | 'high_priority' | 'normal' | 'low_priority';
  const eff = (site.visitEffort ?? '') as '' | 'intensify' | 'maintain' | 'reduce';

  return (
    <div
      className={[
        'rounded-lg border bg-brand-cardBg p-3 space-y-2',
        visited ? 'border-emerald-500/40' : 'border-rose-500/30',
      ].join(' ')}
    >
      {/* Site identity */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-brand-textActive truncate">{site.name}</div>
          {site.contactPersonName && (
            <div className="text-xs text-brand-textMuted truncate">
              {site.contactRole ? `${site.contactRole} · ` : ''}{site.contactPersonName}
            </div>
          )}
          {site.areaName && (
            <div className="text-[10px] text-brand-textMuted/80 truncate">📍 {site.areaName}</div>
          )}
        </div>
        <PhoneActions phone={site.contactPhone} size="sm" />
        <form action={`/api/sites/${site.id}/toggle-visited`} method="post">
          <button
            type="submit"
            title={visited ? 'Mark not visited' : 'Mark visited (today)'}
            className={[
              'shrink-0 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
              visited
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25',
            ].join(' ')}
          >
            {visited ? '✓ Visited' : '○ Not visited'}
          </button>
        </form>
      </div>

      {/* ─────────── Visited state — full assessment summary ─────────── */}
      {visited && (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="font-bold uppercase tracking-wider text-[10px]">Visited:</span>
            <span className="font-semibold">{visitedDateLong ?? '—'}</span>
            {temp && <TempBadge temp={temp} />}
            {reco && <RecoBadge reco={reco} />}
            {eff && <EffortBadge eff={eff} />}
          </div>
          {notePreview && (
            <FieldBlock label="Nature of interaction" body={notePreview} />
          )}
          {site.visitPromises && <FieldBlock label="Promises made" body={site.visitPromises} />}
          {site.visitBenefits && <FieldBlock label="Benefits offered" body={site.visitBenefits} />}
          {site.visitResponse && <FieldBlock label="Response received" body={site.visitResponse} />}
        </div>
      )}

      {/* ─────────── Not-visited — show planned visit summary if set ─────────── */}
      {!visited && plannedDateLong && (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <span className="font-bold uppercase tracking-wider text-[10px]">📅 Visit planned:</span>
            <span className="font-semibold">{plannedDateLong}</span>
          </div>
          {site.plannedPurpose    && <FieldBlock label="Purpose" body={site.plannedPurpose} tone="amber" />}
          {site.plannedObjectives && <FieldBlock label="Objectives" body={site.plannedObjectives} tone="amber" />}
          {site.plannedAttendees  && <FieldBlock label="Attendees" body={site.plannedAttendees} tone="amber" />}
        </div>
      )}

      {/* ─────────── Action form: structured questionnaires ─────────── */}
      <details className="text-xs">
        <summary className="cursor-pointer text-brand-textMuted hover:text-brand-orangeBright select-none list-none flex items-center gap-1 pt-1 border-t border-brand-border/40">
          <span className="text-[10px]">▾</span>
          <span>
            {visited
              ? 'Edit visit assessment'
              : (plannedAt ? 'Update plan or log completed visit' : 'Plan a visit · or log a completed one')}
          </span>
        </summary>

        {/* PLAN A VISIT — required: date + purpose + objectives */}
        {!visited && (
          <form action={`/api/sites/${site.id}/note`} method="post" className="mt-2 space-y-2 bg-amber-500/5 border border-amber-500/30 rounded p-2">
            <input type="hidden" name="action" value="plan" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
              📅 Plan a future visit
            </div>
            <label className="block">
              <FieldLabel>Visit date *</FieldLabel>
              <input
                type="date"
                name="plannedVisitAt"
                defaultValue={plannedIso}
                min={today}
                required
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <FieldLabel>Purpose of visit *</FieldLabel>
              <textarea
                name="plannedPurpose"
                defaultValue={site.plannedPurpose ?? ''}
                maxLength={800}
                rows={2}
                required
                placeholder="Why are we visiting? e.g. introduce candidate, address water shortage, condolence visit…"
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <FieldLabel>Objectives *</FieldLabel>
              <textarea
                name="plannedObjectives"
                defaultValue={site.plannedObjectives ?? ''}
                maxLength={800}
                rows={2}
                required
                placeholder="What concrete outcomes do we want from this visit?"
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <FieldLabel>Attendees (optional)</FieldLabel>
              <input
                type="text"
                name="plannedAttendees"
                defaultValue={site.plannedAttendees ?? ''}
                maxLength={400}
                placeholder="Who from our team will attend?"
                className={INPUT_CLASS}
              />
            </label>
            <div className="flex justify-end">
              <button type="submit" className="rounded-md bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black hover:bg-amber-400">
                Save plan
              </button>
            </div>
          </form>
        )}

        {/* LOG / EDIT — required: full assessment */}
        <form action={`/api/sites/${site.id}/note`} method="post" className="mt-2 space-y-2 bg-emerald-500/5 border border-emerald-500/30 rounded p-2">
          <input type="hidden" name="action" value={visited ? 'edit' : 'log'} />
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            ✓ {visited ? 'Edit visit assessment' : 'Log a completed visit'}
          </div>
          <label className="block">
            <FieldLabel>Visit date *</FieldLabel>
            <input
              type="date"
              name="visitedAt"
              defaultValue={visitedIso}
              max={today}
              required={!visited}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <FieldLabel>Nature of interaction * (≤100 words)</FieldLabel>
            <textarea
              name="visitNote"
              defaultValue={notePreview}
              maxLength={600}
              rows={3}
              required
              placeholder="Who you met, what was discussed, the meeting tone, follow-up signals…"
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <FieldLabel>Promises made *</FieldLabel>
            <textarea
              name="visitPromises"
              defaultValue={site.visitPromises ?? ''}
              maxLength={800}
              rows={2}
              required
              placeholder="What did the campaign promise at this meeting?"
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <FieldLabel>Benefits offered (optional)</FieldLabel>
            <textarea
              name="visitBenefits"
              defaultValue={site.visitBenefits ?? ''}
              maxLength={800}
              rows={2}
              placeholder="Material support, introductions, mediation, programs?"
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <FieldLabel>Response received *</FieldLabel>
            <textarea
              name="visitResponse"
              defaultValue={site.visitResponse ?? ''}
              maxLength={800}
              rows={2}
              required
              placeholder="How did they receive us? Endorsement? Concerns? Conditions?"
              className={INPUT_CLASS}
            />
          </label>

          {/* Welcome temperature — multiple choice */}
          <RadioGroup
            name="visitTemperature"
            label="Welcome temperature *"
            options={[
              { value: 'hot',  label: '🔥 Hot',  desc: 'Enthusiastic, endorsement, mobilising' },
              { value: 'warm', label: '🌤 Warm', desc: 'Positive, receptive, willing to engage' },
              { value: 'cold', label: '🧊 Cold', desc: 'Distant, skeptical, no commitment' },
            ]}
            defaultValue={temp}
            required
          />

          {/* Revisit recommendation */}
          <RadioGroup
            name="visitRecommendation"
            label="Recommend revisit? *"
            options={[
              { value: 'high_priority', label: 'High priority', desc: 'Visit again within 30 days' },
              { value: 'normal',        label: 'Normal cadence', desc: 'Standard outreach rotation' },
              { value: 'low_priority',  label: 'Low priority',  desc: 'Already committed or low ROI' },
            ]}
            defaultValue={reco}
            required
          />

          {/* Effort level */}
          <RadioGroup
            name="visitEffort"
            label="Effort level going forward *"
            options={[
              { value: 'intensify', label: '⬆ Intensify', desc: 'Devote more resources' },
              { value: 'maintain',  label: '➡ Maintain',  desc: 'Keep current cadence' },
              { value: 'reduce',    label: '⬇ Reduce',    desc: 'Scale back resources' },
            ]}
            defaultValue={eff}
            required
          />

          <div className="flex justify-end pt-1">
            <button type="submit" className="rounded-md bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black hover:bg-emerald-400">
              {visited ? 'Update visit' : 'Log visit & mark visited'}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

const INPUT_CLASS = 'w-full bg-brand-field border border-brand-border rounded-md px-2 py-1.5 text-xs text-brand-textActive focus:outline-none focus:border-brand-tealBlue';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-0.5">{children}</span>;
}

function FieldBlock({ label, body, tone = 'emerald' }: { label: string; body: string; tone?: 'emerald' | 'amber' }) {
  const border = tone === 'amber' ? 'border-amber-500/50' : 'border-emerald-500/50';
  const labelColor = tone === 'amber' ? 'text-amber-300/80' : 'text-emerald-300/80';
  return (
    <div className={`text-xs text-brand-textBody leading-relaxed bg-black/10 rounded px-2.5 py-1.5 border-l-2 ${border}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${labelColor}`}>{label}</div>
      {body.length > 200 ? body.slice(0, 200) + '…' : body}
    </div>
  );
}

function TempBadge({ temp }: { temp: 'hot' | 'warm' | 'cold' }) {
  const map = {
    hot:  { txt: '🔥 Hot',  cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    warm: { txt: '🌤 Warm', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    cold: { txt: '🧊 Cold', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  }[temp];
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${map.cls}`}>{map.txt}</span>;
}
function RecoBadge({ reco }: { reco: 'high_priority' | 'normal' | 'low_priority' }) {
  const map = {
    high_priority: { txt: '★ Priority', cls: 'bg-brand-orangeBright/20 text-brand-orangeBright border-brand-orangeBright/40' },
    normal:        { txt: 'Normal',     cls: 'bg-brand-tealBlue/20 text-brand-skyBlue border-brand-tealBlue/40' },
    low_priority:  { txt: 'Low',        cls: 'bg-brand-textMuted/20 text-brand-textMuted border-brand-textMuted/40' },
  }[reco];
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${map.cls}`}>{map.txt}</span>;
}
function EffortBadge({ eff }: { eff: 'intensify' | 'maintain' | 'reduce' }) {
  const map = {
    intensify: { txt: '⬆ Intensify', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    maintain:  { txt: '➡ Maintain',  cls: 'bg-brand-tealBlue/20 text-brand-skyBlue border-brand-tealBlue/40' },
    reduce:    { txt: '⬇ Reduce',    cls: 'bg-brand-textMuted/20 text-brand-textMuted border-brand-textMuted/40' },
  }[eff];
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${map.cls}`}>{map.txt}</span>;
}

interface RadioOption { value: string; label: string; desc: string }
function RadioGroup({
  name, label, options, defaultValue, required,
}: { name: string; label: string; options: RadioOption[]; defaultValue?: string; required?: boolean }) {
  return (
    <fieldset>
      <legend className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-1">{label}</legend>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex items-start gap-1.5 cursor-pointer rounded border border-brand-border bg-black/10 px-2 py-1.5 hover:border-brand-tealBlue has-[:checked]:border-brand-orangeBright has-[:checked]:bg-brand-orangeBright/10"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              required={required}
              className="mt-0.5 accent-brand-orangeBright"
            />
            <span>
              <span className="block text-[11px] font-bold text-brand-textActive">{o.label}</span>
              <span className="block text-[9px] text-brand-textMuted leading-tight">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function prettyType(t: string): string {
  return t
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
