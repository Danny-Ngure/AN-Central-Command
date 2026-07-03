import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql, eq, and, asc, isNull, inArray } from 'drizzle-orm';
import { people, pollingStations, voters, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PhoneActions } from '@/components/phone-actions';
import { Pie } from '@/components/charts/pie';
import { BarChart } from '@/components/charts/bar-chart';
import { streamsForStation } from '@/data/nyali-polling-streams';

// /polling-stations/[id]?tab=voters|streams|demographics|turnout
//
// Tabs (default = voters, addressing the user's clear ask: clicking "View voters"
// should show the voter list FIRST, not the history):
//   • voters       — search + filtered, paginated table (50/page) with phone actions
//   • demographics — gender pie, age bands, youth share donut, women share donut
//   • turnout      — historical bar chart (2013/2017/2022/target) + 2022 margin
//
// Server-rendered — tabs are plain Link navigation, works without JS.

const PAGE_SIZE = 50;
type Tab = 'voters' | 'streams' | 'demographics' | 'turnout';

interface PageProps {
  params: { id: string };
  searchParams: {
    tab?: string;
    page?: string;
    q?: string;
    gender?: string;
  };
}

export default async function PollingStationPage({ params, searchParams }: PageProps) {
  const claims = await getServerAuthOrRedirect();
  const stationId = params.id;
  const tab: Tab = (['voters', 'streams', 'demographics', 'turnout'].includes(searchParams.tab ?? '')
    ? searchParams.tab
    : 'voters') as Tab;
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const q = (searchParams.q ?? '').trim();
  const genderFilter = ['M', 'F', 'U'].includes(searchParams.gender ?? '')
    ? (searchParams.gender as 'M' | 'F' | 'U')
    : null;
  const offset = (page - 1) * PAGE_SIZE;

  const data = await withRlsTx(claims, async (tx) => {
    const stationRows = await tx
      .select({
        id: pollingStations.id,
        iebcCode: pollingStations.iebcCode,
        name: pollingStations.name,
        wardId: pollingStations.wardId,
        wardName: wards.name,
        registeredVoters: pollingStations.registeredVoters,
        turnout2013: pollingStations.turnout2013,
        turnout2017: pollingStations.turnout2017,
        turnout2022: pollingStations.turnout2022,
        targetTurnout: pollingStations.targetTurnout,
        margin2022: pollingStations.margin2022,
      })
      .from(pollingStations)
      .leftJoin(wards, eq(wards.id, pollingStations.wardId))
      .where(eq(pollingStations.id, stationId))
      .limit(1);
    if (stationRows.length === 0) return null;
    const station = stationRows[0]!;

    // Sibling stations in the same ward — feeds the breadcrumb quick-switcher.
    const siblingStations = await tx
      .select({ id: pollingStations.id, name: pollingStations.name })
      .from(pollingStations)
      .where(eq(pollingStations.wardId, station.wardId))
      .orderBy(asc(pollingStations.name));

    // Person in charge — fetch the ward coordinator + assistants for this station's ward.
    const wardTeam = await tx
      .select({
        id: people.id,
        fullName: people.fullName,
        role: people.role,
        title: people.title,
        phone: people.phone,
      })
      .from(people)
      .where(and(
        eq(people.wardId, station.wardId),
        eq(people.active, true),
        isNull(people.deletedAt),
        inArray(people.role, ['ward_coordinator', 'assistant_ward_coordinator']),
      ));

    // Always-fetched demographics aggregate — needed in the header strip too.
    const demoResult = await tx.execute(sql`
      SELECT
        COUNT(*)::int                                                      AS total,
        COUNT(*) FILTER (WHERE gender = 'M')::int                          AS men,
        COUNT(*) FILTER (WHERE gender = 'F')::int                          AS women,
        COUNT(*) FILTER (WHERE gender = 'U')::int                          AS unknown_gender,
        COUNT(*) FILTER (
          WHERE date_of_birth IS NOT NULL
            AND date_part('year', age(date_of_birth)) BETWEEN 18 AND 34
        )::int                                                             AS youth,
        COUNT(*) FILTER (
          WHERE date_of_birth IS NOT NULL
            AND date_part('year', age(date_of_birth)) BETWEEN 35 AND 59
        )::int                                                             AS mid,
        COUNT(*) FILTER (
          WHERE date_of_birth IS NOT NULL
            AND date_part('year', age(date_of_birth)) >= 60
        )::int                                                             AS senior,
        COUNT(*) FILTER (WHERE date_of_birth IS NULL)::int                 AS age_unknown,
        COUNT(*) FILTER (WHERE phone IS NOT NULL)::int                     AS with_phone
      FROM voters
      WHERE polling_station_id = ${stationId}::uuid
        AND consent_withdrawn_at IS NULL
    `);
    const demo = (demoResult as any[])[0] ?? {
      total: 0, men: 0, women: 0, unknown_gender: 0,
      youth: 0, mid: 0, senior: 0, age_unknown: 0, with_phone: 0,
    };

    // Only fetch voter rows when the voters tab is active — saves a query.
    let rows: any[] = [];
    let filteredTotal = 0;
    if (tab === 'voters') {
      const filters = [
        eq(voters.pollingStationId, stationId),
        isNull(voters.consentWithdrawnAt),
      ];
      if (q) {
        filters.push(
          sql`(${voters.surname} ILIKE ${q + '%'} OR ${voters.firstName} ILIKE ${q + '%'})`,
        );
      }
      if (genderFilter) filters.push(eq(voters.gender, genderFilter));
      const where = and(...filters);

      const [countRow] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(voters)
        .where(where);
      filteredTotal = countRow?.total ?? 0;

      rows = await tx
        .select({
          id: voters.id,
          surname: voters.surname,
          firstName: voters.firstName,
          gender: voters.gender,
          dateOfBirth: voters.dateOfBirth,
          phone: voters.phone,
        })
        .from(voters)
        .where(where)
        .orderBy(asc(voters.surname), asc(voters.firstName))
        .limit(PAGE_SIZE)
        .offset(offset);
    }

    return {
      station,
      wardTeam,
      siblingStations,
      demo: {
        total: Number(demo.total),
        men: Number(demo.men),
        women: Number(demo.women),
        unknownGender: Number(demo.unknown_gender),
        youth: Number(demo.youth),
        mid: Number(demo.mid),
        senior: Number(demo.senior),
        ageUnknown: Number(demo.age_unknown),
        withPhone: Number(demo.with_phone),
      },
      rows,
      filteredTotal,
    };
  });

  if (!data) notFound();
  const { station, demo, rows, filteredTotal, wardTeam, siblingStations } = data;
  const wardCoordinator = wardTeam.find((t) => t.role === 'ward_coordinator') ?? null;
  const wardAssistants = wardTeam.filter((t) => t.role === 'assistant_ward_coordinator');
  const pageCount = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const womenPct = demo.total > 0 ? (demo.women / demo.total) * 100 : 0;
  const menPct = demo.total > 0 ? (demo.men / demo.total) * 100 : 0;
  const youthPct = demo.total > 0 ? (demo.youth / demo.total) * 100 : 0;
  const phonePct = demo.total > 0 ? (demo.withPhone / demo.total) * 100 : 0;
  const basePath = `/polling-stations/${stationId}`;

  // Polling STREAMS for this centre (IEBC 2022). Matched by normalised name.
  const stationStreams = streamsForStation(station.name);
  const streamCount = stationStreams?.streams.length ?? 0;
  const streamRegistered = stationStreams?.streams.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <Breadcrumbs
        items={[
          { label: 'Wards', href: '/wards' },
          {
            label: station.wardName ?? 'Ward',
            href: `/wards/${station.wardId}`,
          },
          {
            label: station.name,
            siblings: siblingStations.map((s) => ({
              label: s.name,
              href: `/polling-stations/${s.id}`,
              current: s.id === station.id,
            })),
          },
        ]}
      />
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="space-y-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-brand-textActive">{station.name}</h1>
          <span className="text-xs font-mono text-brand-textMuted">{station.iebcCode}</span>
        </div>
        <p className="text-sm text-brand-textMuted">
          {demo.total.toLocaleString()} voter{demo.total === 1 ? '' : 's'} ·{' '}
          <span className="text-brand-skyBlue">{demo.men.toLocaleString()} men</span> ·{' '}
          <span className="text-brand-orangeBright">{demo.women.toLocaleString()} women</span>
          {station.turnout2022 !== null && (
            <> · 2022 turnout {station.turnout2022}%</>
          )}
        </p>
        {stationStreams && (
          <p className="text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tealBlue/10 border border-brand-tealBlue/30 px-2.5 py-1 text-xs font-semibold text-brand-tealBlue">
              🗳️ {streamCount} polling stream{streamCount === 1 ? '' : 's'} · {streamRegistered.toLocaleString()} registered (IEBC 2022)
            </span>
          </p>
        )}
      </header>

      {/* ─── Person in charge — ward coordinator + assistants ──────────── */}
      {wardCoordinator && (
        <div className="rounded-xl border border-brand-orangeBright/40 bg-brand-orangeBright/5 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-orangeBright mb-2">
            ★ Person in charge — {station.wardName ?? 'this ward'}
          </div>
          <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-brand-orangeBright uppercase tracking-wider text-[10px]">Coordinator</span>
              <span className="text-brand-textActive font-semibold">{wardCoordinator.fullName}</span>
              <span className="text-brand-textMuted font-mono text-[10px]">{wardCoordinator.phone}</span>
              <PhoneActions phone={wardCoordinator.phone} size="sm" />
            </div>
            {wardAssistants.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <span className="font-bold text-brand-skyBlue uppercase tracking-wider text-[10px]">Assistant</span>
                <span className="text-brand-textActive font-semibold">{a.fullName}</span>
                <span className="text-brand-textMuted font-mono text-[10px]">{a.phone}</span>
                <PhoneActions phone={a.phone} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Empty-state guidance ──────────────────────────────────────── */}
      {demo.total === 0 && (
        <div className="rounded-xl border border-brand-warning/40 bg-brand-warning/10 p-5 space-y-2">
          <div className="font-semibold uppercase tracking-wider text-brand-warning text-xs">
            No voters linked to this station
          </div>
          <p className="text-sm text-brand-textBody">
            This is almost always a <strong>seed-data leftover</strong> — the imported voter
            register references a different station name (e.g. "FRERE TOWN PRIMARY SCHOOL"
            vs the seed's "Frere Town Primary").
          </p>
          <p className="text-sm text-brand-textBody">
            On the ward page, click <strong>"⚙ Clean up duplicates"</strong> in the polling
            stations section. It will remove every station in this ward that has 0 voters,
            leaving only the real ones from your import.
          </p>
          <Link
            href={`/wards/${station.wardId}`}
            className="inline-block mt-2 rounded-md bg-brand-orangeBright px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-orangeAlt"
          >
            ← Back to {station.wardName} ward
          </Link>
        </div>
      )}

      {/* ─── Tab navigation ────────────────────────────────────────────── */}
      <nav className="flex gap-2 border-b border-brand-border overflow-x-auto">
        <TabLink href={basePath} active={tab === 'voters'}>
          Voters {demo.total > 0 && <span className="ml-1 text-[10px] opacity-75">({demo.total.toLocaleString()})</span>}
        </TabLink>
        {stationStreams && (
          <TabLink href={`${basePath}?tab=streams`} active={tab === 'streams'}>
            Streams <span className="ml-1 text-[10px] opacity-75">({streamCount})</span>
          </TabLink>
        )}
        <TabLink href={`${basePath}?tab=demographics`} active={tab === 'demographics'}>
          Demographics
        </TabLink>
        <TabLink href={`${basePath}?tab=turnout`} active={tab === 'turnout'}>
          Turnout history
        </TabLink>
      </nav>

      {/* ─── TAB: Voters ───────────────────────────────────────────────── */}
      {tab === 'voters' && demo.total > 0 && (
        <section className="space-y-3">
          <form className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-border bg-brand-cardBg p-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted block mb-1">
                Search (surname or first name)
              </label>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="e.g. Mwangi"
                className="w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted block mb-1">
                Gender
              </label>
              <select
                name="gender"
                defaultValue={genderFilter ?? ''}
                className="bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
              >
                <option value="">All</option>
                <option value="M">Men</option>
                <option value="F">Women</option>
                <option value="U">Unknown</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-brand-tealBlue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-tealBright"
            >
              Filter
            </button>
            {(q || genderFilter) && (
              <Link
                href={basePath}
                className="rounded-md border border-brand-border px-4 py-2 text-sm font-semibold text-brand-textActive hover:border-brand-tealBlue"
              >
                Reset
              </Link>
            )}
          </form>

          <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-auto">
            <div className="flex items-baseline justify-between px-4 py-3 border-b border-brand-border">
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-textMuted">
                Voters · Page {page} of {pageCount} · {filteredTotal.toLocaleString()} matching
              </h2>
            </div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-brand-textMuted">
                  <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Surname</th>
                  <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">First name</th>
                  <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Gender</th>
                  <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Age</th>
                  <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Phone</th>
                  <th className="text-right font-semibold px-3 py-2 border-b border-brand-border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v: any) => (
                  <tr key={v.id} className="border-b border-brand-border/40 last:border-b-0 hover:bg-black/5">
                    <td className="px-3 py-2 text-brand-textActive font-semibold whitespace-nowrap">{v.surname}</td>
                    <td className="px-3 py-2 text-brand-textActive whitespace-nowrap">{v.firstName}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><GenderBadge gender={v.gender} /></td>
                    <td className="px-3 py-2 text-brand-textMuted tabular-nums whitespace-nowrap">{ageFromDob(v.dateOfBirth)}</td>
                    <td className="px-3 py-2 text-brand-textMuted font-mono whitespace-nowrap">
                      {v.phone ? maskPhone(v.phone) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex">
                        <PhoneActions
                          phone={v.phone}
                          size="sm"
                          defaultMessage={`Habari ${v.firstName}. Hii ni timu ya Alfayo Nelson kwa ${station.wardName}.`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-brand-textMuted italic">No voters match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              basePath={basePath}
              q={q}
              gender={genderFilter}
            />
          )}
        </section>
      )}

      {/* ─── TAB: Demographics ─────────────────────────────────────────── */}
      {/* ─── TAB: Streams ──────────────────────────────────────────────── */}
      {tab === 'streams' && stationStreams && (
        <section className="space-y-4 max-w-3xl">
          {/* summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
              <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">Polling streams</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-brand-tealBlue">{streamCount}</div>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
              <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">Registered (IEBC 2022)</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-brand-textActive">{streamRegistered.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
              <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">Avg / stream</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-brand-orangeBright">
                {Math.round(streamRegistered / streamCount).toLocaleString()}
              </div>
            </div>
          </div>

          {/* stream list */}
          <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
            <div className="px-4 py-3 border-b border-brand-border">
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-textMuted">
                {station.name} · streams
              </h2>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-brand-textMuted">
                  <th className="text-left font-semibold px-4 py-2 border-b border-brand-border">Stream</th>
                  <th className="text-right font-semibold px-4 py-2 border-b border-brand-border">Registered voters</th>
                  <th className="text-left font-semibold px-4 py-2 border-b border-brand-border w-1/2">Share of centre</th>
                </tr>
              </thead>
              <tbody>
                {stationStreams.streams.map((v, i) => {
                  const pct = streamRegistered > 0 ? (v / streamRegistered) * 100 : 0;
                  return (
                    <tr key={i} className="hover:bg-black/5">
                      <td className="px-4 py-2.5 border-b border-brand-border/60 font-semibold text-brand-textActive whitespace-nowrap">
                        Stream {String(i + 1).padStart(3, '0')}
                      </td>
                      <td className="px-4 py-2.5 border-b border-brand-border/60 text-right tabular-nums text-brand-textActive">
                        {v.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 border-b border-brand-border/60">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-black/10 overflow-hidden">
                            <div className="h-full bg-brand-tealBlue" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-brand-textMuted tabular-nums w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-brand-cardBgHeavy/40">
                  <td className="px-4 py-2.5 font-bold text-brand-textActive">Total · {streamCount} streams</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-brand-textActive">{streamRegistered.toLocaleString()}</td>
                  <td className="px-4 py-2.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-[11px] text-brand-textMuted italic">
            Streams are the individual desks this centre runs on election day. Figures from the IEBC 2022 Register of
            Voters (per-station); official per-stream KIEMS codes to be confirmed with IEBC. The Voters tab lists the
            actual registered voters linked to this centre.
          </p>
        </section>
      )}

      {tab === 'demographics' && demo.total > 0 && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Voters" value={demo.total.toLocaleString()} hint={`${station.registeredVoters.toLocaleString()} on file`} />
            <Kpi label="Phone reach" value={`${phonePct.toFixed(1)}%`} hint={`${demo.withPhone.toLocaleString()} reachable`} tone="brand" />
            <Kpi label="Women" value={`${womenPct.toFixed(1)}%`} hint={`${demo.women.toLocaleString()} voters`} />
            <Kpi label="Youth (18-34)" value={`${youthPct.toFixed(1)}%`} hint={`${demo.youth.toLocaleString()} voters`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <ChartCard title="Gender split">
              <Pie
                data={[
                  { label: 'Men',     value: demo.men,            color: '#00ccff' },
                  { label: 'Women',   value: demo.women,          color: '#ff6600' },
                  { label: 'Unknown', value: demo.unknownGender,  color: '#64748b' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Age bands">
              <Pie
                data={[
                  { label: 'Youth (18-34)',  value: demo.youth,        color: '#00ccff' },
                  { label: 'Mid (35-59)',    value: demo.mid,          color: '#025e73' },
                  { label: 'Senior (60+)',   value: demo.senior,       color: '#0d4c5c' },
                  { label: 'Age unknown',    value: demo.ageUnknown,   color: '#64748b' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Youth share">
              <Pie
                donut
                centerText={`${youthPct.toFixed(0)}%`}
                centerSubText="Youth"
                data={[
                  { label: 'Youth (18-34)',    value: demo.youth,                                color: '#00ccff' },
                  { label: '35 and over',      value: demo.mid + demo.senior,                    color: '#025e73' },
                  { label: 'Age unknown',      value: demo.ageUnknown,                           color: '#64748b' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Women share">
              <Pie
                donut
                centerText={`${womenPct.toFixed(0)}%`}
                centerSubText="Women"
                data={[
                  { label: 'Women', value: demo.women,           color: '#ff6600' },
                  { label: 'Men',   value: demo.men,             color: '#00ccff' },
                  { label: 'Unknown', value: demo.unknownGender, color: '#64748b' },
                ]}
              />
            </ChartCard>
          </div>
        </section>
      )}

      {/* ─── TAB: Turnout history ──────────────────────────────────────── */}
      {tab === 'turnout' && (
        <section className="space-y-3 max-w-2xl">
          <div className="rounded-xl border border-brand-border bg-brand-cardBg p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-brand-textMuted mb-3">
              Turnout 2013 → 2022 + 2027 target
            </h2>
            <BarChart
              yAxisLabel="Turnout %"
              bars={[
                { label: '2013',   value: station.turnout2013,   color: '#0d4c5c', hint: 'Previous cycle' },
                { label: '2017',   value: station.turnout2017,   color: '#025e73', hint: 'Previous cycle' },
                { label: '2022',   value: station.turnout2022,   color: '#00ccff', hint: 'Last election' },
                { label: 'Target', value: station.targetTurnout, color: '#ff6600', hint: 'D-Day 2027 goal' },
              ]}
            />
            {station.margin2022 !== null && (
              <div className="mt-3 text-xs text-brand-textMuted text-center">
                2022 margin:{' '}
                <span className={station.margin2022 >= 0 ? 'text-brand-success font-semibold' : 'text-brand-danger font-semibold'}>
                  {station.margin2022 >= 0 ? '+' : ''}{station.margin2022.toLocaleString()} votes
                </span>
              </div>
            )}
          </div>

          {demo.total === 0 && (
            <p className="text-xs text-brand-textMuted italic">
              Turnout history is from IEBC seed data. Voter-roster analytics will populate once
              this station's voters are imported (see ward page → "⚙ Clean up duplicates").
            </p>
          )}
        </section>
      )}
    </div>
  );
}

// ---- subcomponents ---------------------------------------------------------

function TabLink({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition whitespace-nowrap',
        active
          ? 'border-brand-orangeBright text-brand-textActive'
          : 'border-transparent text-brand-textMuted hover:text-brand-textActive hover:border-brand-border',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

function Kpi({
  label, value, hint, tone,
}: {
  label: string; value: number | string; hint?: string; tone?: 'brand' | 'success';
}) {
  const valueColor =
    tone === 'brand' ? 'text-brand-skyBlue'
    : tone === 'success' ? 'text-brand-success'
    : 'text-brand-textActive';
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
      {hint && <div className="text-[10px] text-brand-textMuted mt-0.5">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-5">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-3">{title}</h3>
      {children}
    </div>
  );
}

function GenderBadge({ gender }: { gender: string }) {
  const colour =
    gender === 'M' ? 'bg-brand-skyBlue/20 text-brand-skyBlue' :
    gender === 'F' ? 'bg-brand-orangeBright/20 text-brand-orangeBright' :
    'bg-brand-textMuted/20 text-brand-textMuted';
  const label = gender === 'M' ? 'M' : gender === 'F' ? 'F' : '?';
  return <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${colour}`}>{label}</span>;
}

function ageFromDob(dob: string | Date | null): string {
  if (!dob) return '—';
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 120) return '—';
  return String(age);
}

function maskPhone(phone: string): string {
  const m = phone.match(/^(\+\d{3})(\d{3})\d{3}(\d{3,4})$/);
  if (!m) return phone;
  return `${m[1]} ${m[2]} ••• ${m[3]}`;
}

function Pagination({
  page, pageCount, basePath, q, gender,
}: { page: number; pageCount: number; basePath: string; q: string; gender: string | null }) {
  function url(p: number) {
    const params = new URLSearchParams();
    if (p > 1) params.set('page', String(p));
    if (q) params.set('q', q);
    if (gender) params.set('gender', gender);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }
  const around = 2;
  const start = Math.max(1, page - around);
  const end = Math.min(pageCount, page + around);
  const numbers: number[] = [];
  for (let i = start; i <= end; i++) numbers.push(i);
  return (
    <nav className="flex items-center justify-center gap-1 flex-wrap">
      <PageLink href={url(Math.max(1, page - 1))} disabled={page === 1}>← Prev</PageLink>
      {start > 1 && (<><PageLink href={url(1)}>1</PageLink>{start > 2 && <span className="px-1 text-brand-textMuted">…</span>}</>)}
      {numbers.map((n) => <PageLink key={n} href={url(n)} active={n === page}>{n}</PageLink>)}
      {end < pageCount && (<>{end < pageCount - 1 && <span className="px-1 text-brand-textMuted">…</span>}<PageLink href={url(pageCount)}>{pageCount}</PageLink></>)}
      <PageLink href={url(Math.min(pageCount, page + 1))} disabled={page === pageCount}>Next →</PageLink>
    </nav>
  );
}

function PageLink({ href, children, active, disabled }: { href: string; children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  if (disabled) return <span className="px-2 py-1 rounded text-xs text-brand-textMuted/50 cursor-not-allowed">{children}</span>;
  return (
    <Link
      href={href}
      className={['px-2 py-1 rounded text-xs font-semibold', active ? 'bg-brand-tealBlue text-white' : 'text-brand-textActive hover:bg-black/5'].join(' ')}
    >
      {children}
    </Link>
  );
}
