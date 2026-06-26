import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { voters } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { HorizontalBarChart } from '@/components/charts/horizontal-bar';
import { GroupedBarChart } from '@/components/charts/grouped-bar';
import { BarChart } from '@/components/charts/bar-chart';
import { Pie } from '@/components/charts/pie';
import {
  HISTORICAL_ELECTIONS,
  WARD_PROFILES,
  CYCLE_TRENDS,
  type HistoricalElection,
  type HistoricalCandidate,
} from '@/data/elections-history';
import { CURRENT_POLLS, computePollAverage } from '@/data/current-polls';

// /analytics?tab=pollings|history|2013|2017|2022|analysis
//
// Tabs:
//   • pollings    (default) — Swiss Poll Int. + Politrack + cross-poll average
//   • history     — Historical overview (winners + share trend + top-3 trend)
//   • 2013, 2017, 2022 — Per-cycle deep dive (candidates / per-ward / summary)
//   • analysis    — Strategic ward profiles + demographic cross-check
//
// All charts are constrained max-w-md/xl/2xl so they read like dashboard charts
// rather than full-page banners. Each chart has a small commentary line below it.

type Tab = 'pollings' | 'history' | '2013' | '2017' | '2022' | 'analysis';

const COLORS = {
  ours:    '#ff6600',
  rival1:  '#dc2626',
  rival2:  '#0d4c5c',
  neutral: '#64748b',
  teal:    '#025e73',
  sky:     '#00ccff',
  aqua:    '#11b6cb',
  amber:   '#e26d28',
  emerald: '#10b981',
};

interface PageProps {
  searchParams: { tab?: string };
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const claims = await getServerAuthOrRedirect();
  const tab: Tab = (['pollings', 'history', '2013', '2017', '2022', 'analysis'].includes(searchParams.tab ?? '')
    ? searchParams.tab
    : 'pollings') as Tab;

  // Only load voter demographics for the analysis tab.
  const ourDemo = tab === 'analysis'
    ? await withRlsTx(claims, async (tx) => {
        const [row] = (await tx.execute(sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE gender = 'M')::int AS men,
            COUNT(*) FILTER (WHERE gender = 'F')::int AS women,
            COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 18 AND 24)::int AS a_18_24,
            COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 25 AND 34)::int AS a_25_34,
            COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 35 AND 44)::int AS a_35_44,
            COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 45 AND 54)::int AS a_45_54,
            COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) >= 55)::int AS a_55_plus,
            COUNT(*) FILTER (WHERE phone IS NOT NULL)::int AS with_phone
          FROM voters
          WHERE consent_withdrawn_at IS NULL
        `)) as any[];
        return row ?? null;
      })
    : null;

  // Real registered-voter weight per ward — used to project the per-ward split of
  // a complete cycle's result (the only honest basis we have for a per-ward view).
  const wardWeights = (['2013', '2017', '2022'].includes(tab))
    ? await withRlsTx(claims, async (tx) => {
        const rows = (await tx.execute(sql`
          SELECT w.name AS name, COUNT(v.*)::int AS registered
          FROM wards w
          LEFT JOIN voters v ON v.ward_id = w.id AND v.consent_withdrawn_at IS NULL
          GROUP BY w.name
          ORDER BY w.name
        `)) as any[];
        return rows.map((r) => ({ name: String(r.name), registered: Number(r.registered) }));
      })
    : null;

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Pollings &amp; Analysis</h1>
        <p className="text-sm text-brand-textMuted">
          Current race standing, historical IEBC results (2013-2022), per-ward swing
          analysis, and demographic cross-check against our imported voter register.
        </p>
      </header>

      {/* Tab nav */}
      <nav className="flex gap-1 border-b border-brand-border overflow-x-auto">
        <TabLink href="/analytics" active={tab === 'pollings'}>Pollings</TabLink>
        <TabLink href="/analytics?tab=history" active={tab === 'history'}>Historical results</TabLink>
        <TabLink href="/analytics?tab=2013" active={tab === '2013'}>2013</TabLink>
        <TabLink href="/analytics?tab=2017" active={tab === '2017'}>2017</TabLink>
        <TabLink href="/analytics?tab=2022" active={tab === '2022'}>2022</TabLink>
        <TabLink href="/analytics?tab=analysis" active={tab === 'analysis'}>Analysis &amp; demographics</TabLink>
      </nav>

      {tab === 'pollings'  && <TabPollings />}
      {tab === 'history'   && <TabHistory />}
      {tab === '2013'      && <TabCycle election={HISTORICAL_ELECTIONS.find((e) => e.year === 2013)!} wardWeights={wardWeights} />}
      {tab === '2017'      && <TabCycle election={HISTORICAL_ELECTIONS.find((e) => e.year === 2017)!} wardWeights={wardWeights} />}
      {tab === '2022'      && <TabCycle election={HISTORICAL_ELECTIONS.find((e) => e.year === 2022)!} wardWeights={wardWeights} />}
      {tab === 'analysis'  && <TabAnalysis demo={ourDemo} />}
    </div>
  );
}

// ─── TAB: Pollings ─────────────────────────────────────────────────────────────

function TabPollings() {
  const pollAvg = computePollAverage();
  const leadAvg = pollAvg[0];
  const runnerUpAvg = pollAvg[1];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {CURRENT_POLLS.map((p) => (
          <PollCard key={p.source} poll={p} />
        ))}
      </div>

      {/* Cross-poll average — donut highlighting Alfayo's average share, bars beside */}
      <ChartCard title={`Cross-poll average (${CURRENT_POLLS.length} polls)`} subtitle="unweighted mean across pollsters">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
          {/* Donut on the left */}
          <div className="flex flex-col items-center">
            <Pie
              donut
              size={170}
              showLegend={false}
              centerText={`${leadAvg?.averagePct.toFixed(0)}%`}
              centerSubText={leadAvg?.name.split(' ')[0]}
              data={pollAvg.map((c) => ({
                label: c.name,
                value: c.averagePct,
                color: c.ourCandidate ? COLORS.ours : c.averagePct > 10 ? COLORS.rival1 : COLORS.rival2,
              }))}
            />
            <div className="text-[10px] uppercase tracking-wider text-brand-textMuted mt-2 font-bold">
              {leadAvg?.name} avg
            </div>
          </div>
          {/* Bars on the right */}
          <div>
            <HorizontalBarChart
              bars={pollAvg.map((c) => ({
                label: c.name,
                value: c.averagePct,
                color: c.ourCandidate ? COLORS.ours : c.averagePct > 10 ? COLORS.rival1 : COLORS.rival2,
                highlight: c.ourCandidate,
                sublabel: c.spread > 0 ? `±${(c.spread / 2).toFixed(1)} pt spread` : undefined,
              }))}
            />
          </div>
        </div>
        <Caption>
          <strong>Strategic read:</strong>{' '}
          Alfayo is polling <strong>{leadAvg?.averagePct.toFixed(1)}%</strong> on average — a{' '}
          <strong>{((leadAvg?.averagePct ?? 0) - (runnerUpAvg?.averagePct ?? 0)).toFixed(1)}-point</strong>{' '}
          lead over {runnerUpAvg?.name}. Focus shifts from persuasion to{' '}
          <strong>turnout protection</strong> (especially Kongowea) and the undecided segment.
        </Caption>
      </ChartCard>
    </div>
  );
}

// ─── TAB: Historical overview ─────────────────────────────────────────────────

function TabHistory() {
  // Winner votes are only charted for cycles where the figure is sourced.
  const winnerVoteBars = HISTORICAL_ELECTIONS
    .map((e) => ({ year: e.year, w: e.candidates.find((c) => c.isWinner) }))
    .filter((x) => x.w?.votes != null)
    .map((x, i) => ({
      label: String(x.year),
      value: x.w!.votes as number,
      color: ['#00ccff', '#ff6600', '#0d4c5c'][i] ?? '#025e73',
      hint: `${(x.w!.votes as number).toLocaleString()} votes`,
    }));

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-brand-skyBlue/40 bg-brand-skyBlue/10 px-4 py-2.5 text-xs text-brand-textBody">
        ℹ️ Figures are verified against IEBC declarations &amp; Kenyan news (sources on each cycle tab).
        Where official tallies aren&apos;t yet sourced (2013, and the minor 2017 candidates), numbers are shown as
        <strong> not loaded</strong> rather than estimated.
      </div>

      {/* Winner cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {HISTORICAL_ELECTIONS.map((e) => {
          const trend = CYCLE_TRENDS.find((t) => t.year === e.year);
          const winner = e.candidates.find((c) => c.isWinner)!;
          const runnerUp = e.candidates.find((c) => !c.isWinner);
          return (
            <div key={e.year} className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">{e.year} winner</div>
              <div className="text-base font-extrabold text-brand-textActive mt-1">{winner.name}</div>
              <div className="text-xs text-brand-textMuted">{winner.party}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <Mini label="Votes" value={winner.votes != null ? winner.votes.toLocaleString() : 'Not loaded'} />
                <Mini label="Share" value={trend ? `${trend.winnerShare.toFixed(1)}%` : '—'} />
                <Mini label="Runner-up" value={runnerUp?.name ?? '—'} />
                <Mini label="Margin" value={trend ? trend.winningMargin.toLocaleString() : '—'} />
              </div>
              <a href={e.source} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-brand-aqua hover:text-brand-skyBlue underline">
                Source: {e.sourceLabel} ↗
              </a>
            </div>
          );
        })}
      </div>

      <ChartCard title="Winner votes by cycle" subtitle="official tally of the eventual MP (only where sourced)">
        <BarChart yAxisLabel="Winner votes" className="max-w-lg" bars={winnerVoteBars} />
        <Caption>
          Mohamed Ali grew his tally from 26,798 (2017, Independent) to 32,933 (2022, UDA). The 2013
          figure isn&apos;t charted because the official tally hasn&apos;t been loaded yet.
        </Caption>
      </ChartCard>
    </div>
  );
}

// ─── TAB: Per-cycle (2013 / 2017 / 2022) ──────────────────────────────────────

function TabCycle({ election, wardWeights }: { election: HistoricalElection; wardWeights: { name: string; registered: number }[] | null }) {
  const trend = CYCLE_TRENDS.find((t) => t.year === election.year);
  const winner = election.candidates.find((c) => c.isWinner)!;
  const runnerUp = election.candidates.find((c) => !c.isWinner);
  const hasVotes = election.candidates.every((c) => c.votes != null);
  const totalValid = election.complete ? election.candidates.reduce((s, c) => s + (c.votes ?? 0), 0) : null;
  const pctOf = (v: number) => (totalValid ? (v / totalValid) * 100 : 0);
  const marginVotes = winner.votes != null && runnerUp?.votes != null ? winner.votes - runnerUp.votes : null;

  return (
    <div className="space-y-5">
      {/* Data-completeness banner */}
      <div className={[
        'rounded-lg border px-4 py-2.5 text-xs',
        election.complete
          ? 'border-brand-success/40 bg-brand-success/10 text-brand-textBody'
          : 'border-brand-gold/50 bg-brand-gold/10 text-brand-textBody',
      ].join(' ')}>
        {election.complete
          ? '✓ Full official slate loaded (IEBC declaration).'
          : '⚠ Partial data — only the confirmed leading candidates are shown; official tallies for the rest are not yet loaded.'}
        {' '}
        <a href={election.source} target="_blank" rel="noopener noreferrer" className="text-brand-aqua hover:text-brand-skyBlue underline">
          Source: {election.sourceLabel} ↗
        </a>
      </div>

      {/* Headline strip */}
      <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Mini label={`${election.year} winner`} value={winner.name} />
        <Mini label="Party" value={winner.party} />
        <Mini label="Votes" value={winner.votes != null ? winner.votes.toLocaleString() : 'Not loaded'} />
        <Mini label="Share" value={trend ? `${trend.winnerShare.toFixed(1)}%` : '—'} />
        <Mini label="Margin" value={
          marginVotes != null
            ? `${marginVotes.toLocaleString()}${totalValid ? ` · ${pctOf(marginVotes).toFixed(1)} pts` : ''}`
            : '—'
        } />
      </div>

      {/* Candidates */}
      <ChartCard
        title={`${election.year} candidates`}
        subtitle={election.complete ? 'vote share of total valid votes' : hasVotes ? 'official votes (full slate not loaded — share not computed)' : 'confirmed candidates — official tallies not yet loaded'}
      >
        {election.complete && totalValid ? (
          <div className="max-w-5xl">
            <HorizontalBarChart
              max={Math.max(10, Math.ceil(pctOf(winner.votes as number) / 10) * 10)}
              bars={election.candidates.map((c, i) => ({
                label: c.name,
                value: pctOf(c.votes as number),
                color: c.isWinner ? COLORS.teal : i === 1 ? COLORS.amber : i === 2 ? COLORS.aqua : COLORS.neutral,
                highlight: c.isWinner,
                sublabel: `${c.party} · ${(c.votes as number).toLocaleString()} votes`,
              }))}
            />
          </div>
        ) : hasVotes ? (
          <div className="space-y-2 max-w-2xl">
            {election.candidates.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-cardBgHeavy/40 px-3 py-2">
                <div>
                  <span className="text-sm font-semibold text-brand-textActive">{c.name}</span>
                  <span className="text-xs text-brand-textMuted"> · {c.party}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold tabular-nums text-brand-textActive">{(c.votes as number).toLocaleString()}</span>
                  <span className={`ml-2 text-[10px] uppercase font-bold tracking-wider ${c.isWinner ? 'text-brand-success' : 'text-brand-textMuted'}`}>{c.isWinner ? 'Winner' : i === 1 ? 'Runner-up' : ''}</span>
                </div>
              </div>
            ))}
            {marginVotes != null && (
              <div className="text-xs text-brand-textBody pt-1">Winning margin: <strong>{marginVotes.toLocaleString()}</strong> votes (head-to-head {((winner.votes as number) / ((winner.votes as number) + (runnerUp!.votes as number)) * 100).toFixed(1)}% vs {((runnerUp!.votes as number) / ((winner.votes as number) + (runnerUp!.votes as number)) * 100).toFixed(1)}%).</div>
            )}
          </div>
        ) : (
          <ul className="space-y-2 max-w-2xl">
            {election.candidates.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-cardBgHeavy/40 px-3 py-2">
                <div>
                  <span className="text-sm font-semibold text-brand-textActive">{c.name}</span>
                  <span className="text-xs text-brand-textMuted"> · {c.party}</span>
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${c.isWinner ? 'text-brand-success' : 'text-brand-textMuted'}`}>
                  {c.isWinner ? 'Winner' : 'Runner-up'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Caption>
          {trend ? (
            <><strong>{winner.name}</strong> ({winner.party}) won with <strong>{trend.winnerShare.toFixed(1)}%</strong>; runner-up <strong>{runnerUp?.name}</strong> ({runnerUp?.party}) on <strong>{trend.runnerUpShare.toFixed(1)}%</strong>. Margin: <strong>{trend.winningMargin.toLocaleString()}</strong> votes (<strong>{pctOf(trend.winningMargin).toFixed(1)} points</strong>).</>
          ) : marginVotes != null ? (
            <><strong>{winner.name}</strong> ({winner.party}) beat <strong>{runnerUp?.name}</strong> ({runnerUp?.party}) by <strong>{marginVotes.toLocaleString()}</strong> votes. Constituency-wide percentage isn&apos;t shown because the full slate isn&apos;t loaded.</>
          ) : (
            <><strong>{winner.name}</strong> ({winner.party}) won; runner-up <strong>{runnerUp?.name}</strong> ({runnerUp?.party}). Official vote tallies for this cycle are not yet loaded.</>
          )}
        </Caption>
      </ChartCard>

      {/* Per-ward projection — only for cycles with a complete official slate */}
      {election.complete && wardWeights && wardWeights.length > 0 && (
        <PerWardProjection election={election} wardWeights={wardWeights} />
      )}

      {/* Notes */}
      <ChartCard title={`${election.year} notes`} subtitle="verified facts &amp; data caveats">
        <ul className="text-sm text-brand-textBody space-y-1">
          {election.notes.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-brand-orangeBright">›</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </ChartCard>
    </div>
  );
}

// Per-ward outlook: distributes the verified constituency top-3 result across
// wards in proportion to each ward's REAL registered-voter count (uniform model).
// Honest framing: the ward WEIGHT pie is real data; the per-candidate split is an
// estimate, because official per-ward MP tallies are not published.
function PerWardProjection({
  election, wardWeights,
}: {
  election: HistoricalElection;
  wardWeights: { name: string; registered: number }[];
}) {
  const totalReg = wardWeights.reduce((s, w) => s + w.registered, 0) || 1;
  const top3 = [...election.candidates]
    .filter((c) => c.votes != null)
    .sort((a, b) => (b.votes as number) - (a.votes as number))
    .slice(0, 3) as Array<HistoricalCandidate & { votes: number }>;
  const palette = [COLORS.teal, COLORS.amber, COLORS.aqua, COLORS.sky, COLORS.emerald];

  // Real constituency shares (percentages) of the top-3.
  const totalAll = election.candidates.reduce((s, c) => s + (c.votes ?? 0), 0) || 1;
  const winnerC = top3[0];
  const runnerC = top3[1];
  const sharePct = (v: number) => (v / totalAll) * 100;

  // Estimated votes per ward per top-3 candidate (uniform model).
  const est = (votes: number, reg: number) => Math.round(votes * (reg / totalReg));

  return (
    <ChartCard
      title={`${election.year} — per-ward outlook (top 3)`}
      subtitle="estimated split of the verified result, weighted by each ward's registered voters"
    >
      <div className="rounded-lg border border-brand-gold/50 bg-brand-gold/10 px-3 py-2 text-[11px] text-brand-textBody mb-4">
        ⚠ <strong>Estimate, not official.</strong> Per-ward MP tallies aren&apos;t published. Bars/pies distribute the
        confirmed constituency result across wards by registered-voter weight (assumes each ward votes like the
        constituency average). The <strong>ward-weight pie is real data</strong>.
      </div>

      {/* Real data: ward electoral weight */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-center mb-6">
        <div className="flex flex-col items-center">
          <Pie
            donut size={180}
            centerText={totalReg.toLocaleString()}
            centerSubText="registered"
            data={wardWeights.map((w, i) => ({ label: w.name, value: w.registered, color: palette[i] ?? COLORS.neutral }))}
          />
          <div className="text-[11px] text-brand-textMuted mt-2">Ward electoral weight (real)</div>
        </div>
        <BarChart
          yAxisLabel="Registered voters"
          bars={wardWeights.map((w, i) => ({ label: w.name, value: w.registered, color: palette[i] ?? COLORS.neutral, hint: `${((w.registered / totalReg) * 100).toFixed(1)}%` }))}
        />
      </div>

      {/* Constituency top-3 — real percentages + margin */}
      <div className="rounded-lg border border-brand-border bg-brand-cardBgHeavy/40 p-3 mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-brand-textMuted mb-2">Constituency result (real %)</div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {top3.map((c, i) => (
            <span key={c.name} className="text-brand-textBody">
              <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: palette[i] }} />
              <strong className="text-brand-textActive">{c.name.split(' ')[0]}</strong> {c.votes.toLocaleString()} · <strong>{sharePct(c.votes).toFixed(1)}%</strong>
            </span>
          ))}
          {winnerC && runnerC && (
            <span className="text-brand-textBody">Margin: <strong className="text-brand-orangeBright">{(winnerC.votes - runnerC.votes).toLocaleString()}</strong> ({(sharePct(winnerC.votes) - sharePct(runnerC.votes)).toFixed(1)} pts)</span>
          )}
        </div>
      </div>

      {/* Estimated top-3 votes by ward (grouped bar) */}
      <GroupedBarChart
        yAxisLabel="Est. votes"
        className="max-w-5xl"
        groups={wardWeights.map((w) => w.name)}
        series={top3.map((c, i) => ({
          label: `${c.name.split(' ')[0]} (${sharePct(c.votes).toFixed(0)}%)`,
          color: palette[i] ?? COLORS.neutral,
          values: wardWeights.map((w) => est(c.votes, w.registered)),
        }))}
      />

      {/* Per-ward summary — estimated votes, margin, share of winner's total */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-brand-textMuted text-left">
              <th className="py-1.5 pr-3 font-bold">Ward</th>
              <th className="py-1.5 px-3 font-bold text-right">Reg. voters</th>
              {winnerC && <th className="py-1.5 px-3 font-bold text-right">Est. {winnerC.name.split(' ')[0]}</th>}
              {runnerC && <th className="py-1.5 px-3 font-bold text-right">Est. {runnerC.name.split(' ')[0]}</th>}
              <th className="py-1.5 px-3 font-bold text-right">Est. margin</th>
              <th className="py-1.5 pl-3 font-bold text-right">% of winner&apos;s votes</th>
            </tr>
          </thead>
          <tbody>
            {wardWeights.map((w) => {
              const ew = winnerC ? est(winnerC.votes, w.registered) : 0;
              const er = runnerC ? est(runnerC.votes, w.registered) : 0;
              const shareOfWinner = winnerC ? (ew / winnerC.votes) * 100 : 0;
              return (
                <tr key={w.name} className="border-t border-brand-border/40">
                  <td className="py-1.5 pr-3 font-semibold text-brand-textActive">{w.name}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-brand-textBody">{w.registered.toLocaleString()}</td>
                  {winnerC && <td className="py-1.5 px-3 text-right tabular-nums text-brand-teal font-semibold">{ew.toLocaleString()}</td>}
                  {runnerC && <td className="py-1.5 px-3 text-right tabular-nums text-brand-textBody">{er.toLocaleString()}</td>}
                  <td className="py-1.5 px-3 text-right tabular-nums text-brand-orangeBright font-semibold">+{(ew - er).toLocaleString()}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums text-brand-textBody">{shareOfWinner.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-ward top-3 donuts — winner share in the centre */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
        {wardWeights.map((w) => (
          <div key={w.name} className="flex flex-col items-center">
            <Pie
              donut size={120}
              showLegend={false}
              centerText={winnerC ? `${sharePct(winnerC.votes).toFixed(0)}%` : ''}
              centerSubText={winnerC ? winnerC.name.split(' ')[0] : ''}
              data={top3.map((c, i) => ({ label: c.name.split(' ')[0], value: est(c.votes, w.registered), color: palette[i] ?? COLORS.neutral }))}
            />
            <div className="text-[11px] font-semibold text-brand-textActive mt-1">{w.name}</div>
            <div className="text-[10px] text-brand-textMuted">~{w.registered.toLocaleString()} voters</div>
          </div>
        ))}
      </div>

      <Caption>
        Top 3 ({election.year}): {top3.map((c) => `${c.name.split(' ')[0]} ${c.votes.toLocaleString()}`).join(' · ')}.
        Kongowea and the larger wards carry the most weight, so they dominate the projected counts — which is why
        turnout there decides the seat.
      </Caption>
    </ChartCard>
  );
}

// ─── TAB: Analysis & Demographics ─────────────────────────────────────────────

function TabAnalysis({ demo }: { demo: any | null }) {
  const total       = Number(demo?.total ?? 0);
  const ourMen      = Number(demo?.men ?? 0);
  const ourWomen    = Number(demo?.women ?? 0);
  const ourMenPct   = total > 0 ? (ourMen / total) * 100 : 0;
  const ourWomenPct = total > 0 ? (ourWomen / total) * 100 : 0;
  const ourAge: Record<string, number> = {
    '18-24': total > 0 ? (Number(demo?.a_18_24 ?? 0) / total) * 100 : 0,
    '25-34': total > 0 ? (Number(demo?.a_25_34 ?? 0) / total) * 100 : 0,
    '35-44': total > 0 ? (Number(demo?.a_35_44 ?? 0) / total) * 100 : 0,
    '45-54': total > 0 ? (Number(demo?.a_45_54 ?? 0) / total) * 100 : 0,
    '55+':   total > 0 ? (Number(demo?.a_55_plus ?? 0) / total) * 100 : 0,
  };
  const swissSample = CURRENT_POLLS[0];

  return (
    <div className="space-y-5">
      {/* Strategic ward profiles */}
      <ChartCard title="Strategic ward profiles" subtitle="behaviour patterns 2013-2022 — turnout-priority guidance for 2027">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WARD_PROFILES.map((w) => (
            <div key={w.name} className="rounded-lg border border-brand-border bg-black/10 p-3">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <h3 className="text-sm font-bold text-brand-textActive">{w.name}</h3>
                <span className={behaviourBadgeClass(w.behaviour)}>{w.oneLiner}</span>
              </div>
              <p className="text-xs text-brand-textBody leading-relaxed">{w.note}</p>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Demographic cross-check — gender */}
      <ChartCard
        title="Gender — our register vs Swiss Poll sample"
        subtitle={`${total.toLocaleString()} voters vs n=${swissSample?.sampleSize}`}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-1 text-center">
              Our register
            </div>
            <Pie
              size={140}
              data={[
                { label: 'Men',   value: ourMen,   color: COLORS.sky },
                { label: 'Women', value: ourWomen, color: COLORS.ours },
              ]}
            />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-1 text-center">
              Swiss sample
            </div>
            {swissSample?.demographics?.gender && (
              <Pie
                size={140}
                data={[
                  { label: 'Men',   value: swissSample.demographics.gender.men,   color: COLORS.sky },
                  { label: 'Women', value: swissSample.demographics.gender.women, color: COLORS.ours },
                ]}
              />
            )}
          </div>
        </div>
        <Caption>
          Register: <strong>{ourMenPct.toFixed(1)}% men / {ourWomenPct.toFixed(1)}% women.</strong>{' '}
          Swiss sample:{' '}
          <strong>
            {(((swissSample?.demographics?.gender?.men ?? 0) /
              ((swissSample?.demographics?.gender?.men ?? 0) + (swissSample?.demographics?.gender?.women ?? 1))) * 100).toFixed(1)}% men.
          </strong>{' '}
          Both samples roughly mirror each other — the published poll is gender-representative.
        </Caption>
      </ChartCard>

      {/* Age bands */}
      <ChartCard
        title="Age bands — our register vs Swiss sample"
        subtitle="% of total in each band"
      >
        <GroupedBarChart
          yAxisLabel="% of sample"
          className="max-w-5xl"
          groups={['18-24', '25-34', '35-44', '45-54', '55+']}
          series={[
            {
              label: 'Our register',
              color: COLORS.aqua,
              values: [ourAge['18-24']!, ourAge['25-34']!, ourAge['35-44']!, ourAge['45-54']!, ourAge['55+']!],
            },
            {
              label: 'Swiss sample',
              color: COLORS.ours,
              values: [
                swissSample?.demographics?.ageGroups?.['18-24'] ?? 0,
                swissSample?.demographics?.ageGroups?.['25-34'] ?? 0,
                swissSample?.demographics?.ageGroups?.['35-44'] ?? 0,
                swissSample?.demographics?.ageGroups?.['45-54'] ?? 0,
                swissSample?.demographics?.ageGroups?.['55+']   ?? 0,
              ],
            },
          ]}
        />
        <Caption>
          The Swiss sample is <strong>heavily 25-34 ({swissSample?.demographics?.ageGroups?.['25-34']}%)</strong>;
          our voter register is more evenly spread. If Alfayo's lead is concentrated in that band,
          real-world turnout among older voters becomes the decisive 2027 swing factor.
        </Caption>
      </ChartCard>

      {/* Our register age donut */}
      <ChartCard title="Our voter register — age distribution" subtitle="from the imported IEBC voter list">
        <Pie
          donut
          size={180}
          centerText={total.toLocaleString()}
          centerSubText="voters"
          data={[
            { label: '18-24',  value: Number(demo?.a_18_24 ?? 0),   color: '#0d4c5c' },
            { label: '25-34',  value: Number(demo?.a_25_34 ?? 0),   color: '#025e73' },
            { label: '35-44',  value: Number(demo?.a_35_44 ?? 0),   color: '#0891a8' },
            { label: '45-54',  value: Number(demo?.a_45_54 ?? 0),   color: '#00ccff' },
            { label: '55+',    value: Number(demo?.a_55_plus ?? 0), color: '#ff6600' },
          ]}
        />
        <Caption>
          Real composition of who is actually on the roll. Compare against the campaign's actual
          contact lists — any band substantially under-reached should drive door-to-door priority.
        </Caption>
      </ChartCard>
    </div>
  );
}

// ─── Helpers / shared subcomponents ───────────────────────────────────────────

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        'px-3 py-2 text-xs md:text-sm font-semibold border-b-2 -mb-px transition whitespace-nowrap',
        active
          ? 'border-brand-orangeBright text-brand-textActive'
          : 'border-transparent text-brand-textMuted hover:text-brand-textActive hover:border-brand-border',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4 space-y-3">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-textActive">{title}</h3>
        {subtitle && <p className="text-[10px] text-brand-textMuted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-brand-textBody leading-relaxed border-t border-brand-border/40 pt-2">
      {children}
    </p>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-bold text-brand-textActive tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted">{label}</div>
    </div>
  );
}

function PollCard({ poll }: { poll: typeof CURRENT_POLLS[number] }) {
  const dt = new Date(poll.publishedAt).toLocaleDateString('en-KE', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const leader = poll.candidates.find((c) => c.ourCandidate) ?? poll.candidates[0]!;
  // Pie data — include the candidates + Undecided slice so the whole 100% accounts.
  const pieData = [
    ...poll.candidates.map((c) => ({
      label: c.name,
      value: c.percent,
      color: c.ourCandidate ? COLORS.ours : c.percent > 10 ? COLORS.rival1 : c.percent > 2 ? COLORS.aqua : COLORS.rival2,
    })),
    ...(poll.undecidedPct ? [{ label: 'Undecided', value: poll.undecidedPct, color: COLORS.neutral }] : []),
    ...(poll.othersPct ? [{ label: 'Others', value: poll.othersPct, color: '#475569' }] : []),
  ];

  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-brand-textActive">{poll.source}</h3>
          <div className="text-[10px] text-brand-textMuted">{dt}</div>
        </div>
        <div className="text-right text-[10px] text-brand-textMuted">
          {poll.sampleSize && <div>n = {poll.sampleSize.toLocaleString()}</div>}
          {poll.marginErrorPct && <div>±{poll.marginErrorPct}% · {poll.confidenceLevelPct}% CL</div>}
        </div>
      </div>

      {/* Donut + horizontal bars side-by-side */}
      <div className="grid grid-cols-[150px_1fr] gap-4 items-center">
        <div className="flex flex-col items-center">
          <Pie
            donut
            size={140}
            showLegend={false}
            centerText={`${leader.percent}%`}
            centerSubText={leader.name.split(' ')[0]?.toUpperCase()}
            data={pieData}
          />
        </div>
        <div>
          <HorizontalBarChart
            bars={poll.candidates.map((c) => ({
              label: c.name,
              value: c.percent,
              color: c.ourCandidate ? COLORS.ours : c.percent > 10 ? COLORS.rival1 : COLORS.rival2,
              highlight: c.ourCandidate,
            }))}
          />
        </div>
      </div>

      <div className="flex items-baseline justify-between text-[10px] text-brand-textMuted pt-2 border-t border-brand-border/50">
        {poll.undecidedPct !== undefined && <span>Undecided: <strong className="text-brand-textBody">{poll.undecidedPct}%</strong></span>}
        {poll.othersPct !== undefined && <span>Others: <strong className="text-brand-textBody">{poll.othersPct}%</strong></span>}
      </div>
    </div>
  );
}

function behaviourBadgeClass(b: string): string {
  const base = 'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded';
  switch (b) {
    case 'powerhouse':    return `${base} bg-brand-orangeBright/20 text-brand-orangeBright`;
    case 'swing':         return `${base} bg-brand-warning/20 text-brand-warning`;
    case 'odm_leaning':   return `${base} bg-brand-danger/20 text-brand-danger`;
    case 'mixed':         return `${base} bg-brand-aqua/20 text-brand-aqua`;
    case 'stable_middle': return `${base} bg-brand-tealBlue/20 text-brand-skyBlue`;
    default:              return base;
  }
}

