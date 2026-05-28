import { and, count, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  activities,
  committedSupporters,
  incidents,
  people,
  pollingStations,
  villageIssues,
  wards,
} from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { ConstituencyMap } from '@/components/map/constituency-map';

// Dashboard page — server component. Fetches data directly via withRlsTx() rather
// than calling its own API route, since we're already on the server with auth in hand.
// Both paths (this page rendering and the /api/dashboard/summary endpoint) return
// the same data shape, scoped identically by RLS.

const ISSUE_LABEL: Record<string, string> = {
  water: 'Water supply',
  sanitation: 'Sanitation',
  garbage: 'Garbage',
  drainage: 'Drainage / flooding',
  roads: 'Roads',
  security: 'Security',
  electricity: 'Electricity',
  youth_unemployment: 'Youth unemployment',
  healthcare: 'Healthcare',
  education: 'Education',
};

export default async function DashboardPage() {
  const claims = await getServerAuthOrRedirect();

  const summary = await withRlsTx(claims, async (tx) => {
    const wardRows = await tx
      .select({
        id: wards.id,
        name: wards.name,
        registeredVoters: wards.registeredVoters,
        coveragePercent: wards.coveragePercent,
        topIssueCategory: wards.topIssueCategory,
        lng: sql<number>`ST_X(${wards.centroid}::geometry)`,
        lat: sql<number>`ST_Y(${wards.centroid}::geometry)`,
      })
      .from(wards)
      .orderBy(wards.name);

    const stationRows = await tx
      .select({
        id: pollingStations.id,
        name: pollingStations.name,
        wardId: pollingStations.wardId,
        lng: sql<number>`ST_X(${pollingStations.location}::geometry)`,
        lat: sql<number>`ST_Y(${pollingStations.location}::geometry)`,
      })
      .from(pollingStations);

    const totalVoters = wardRows.reduce((sum, w) => sum + (w.registeredVoters ?? 0), 0);

    const [{ value: criticalIssues }] = await tx
      .select({ value: count() })
      .from(villageIssues)
      .where(and(eq(villageIssues.severity, 'critical'), inArray(villageIssues.status, ['reported', 'investigating'])));

    const [{ value: activeIncidents }] = await tx
      .select({ value: count() })
      .from(incidents)
      .where(inArray(incidents.status, ['reported', 'investigating', 'escalated']));

    const [{ value: supporterCount }] = await tx
      .select({ value: count() })
      .from(committedSupporters)
      .where(eq(committedSupporters.withdrawn, false));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [{ value: activeStaff }] = await tx
      .select({ value: count() })
      .from(people)
      .where(and(eq(people.active, true), gte(people.lastActiveAt, sevenDaysAgo)));

    const today = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const upcomingActivities = await tx
      .select({
        id: activities.id,
        title: activities.title,
        type: activities.type,
        scheduledAt: activities.scheduledAt,
        wardId: activities.wardId,
        status: activities.status,
      })
      .from(activities)
      .where(gte(activities.scheduledAt, today))
      .orderBy(activities.scheduledAt)
      .limit(5);

    return {
      wardRows,
      stationRows,
      kpis: {
        totalVoters,
        criticalIssues: Number(criticalIssues),
        activeIncidents: Number(activeIncidents),
        supporterCount: Number(supporterCount),
        activeStaff: Number(activeStaff),
      },
      upcomingActivities,
    };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Zen Dashboard</h1>
        <p className="text-sm text-brand-textMuted">
          Snapshot of Nyali Constituency operations. Scoped to your role.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Registered voters" value={summary.kpis.totalVoters.toLocaleString()} />
        <Kpi label="Critical issues" value={summary.kpis.criticalIssues} tone="danger" />
        <Kpi label="Active incidents" value={summary.kpis.activeIncidents} tone="warning" />
        <Kpi label="Committed supporters" value={summary.kpis.supporterCount} />
        <Kpi label="Active staff (7d)" value={summary.kpis.activeStaff} />
      </section>

      {/* Constituency map — SRS FR-091 AC-091.1 (visual anchor) */}
      <ConstituencyMap wards={summary.wardRows} stations={summary.stationRows} />

      {/* Wards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-textMuted uppercase tracking-wider">
            Wards
          </h2>
          <span className="text-xs text-brand-textMuted">{summary.wardRows.length} total</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {summary.wardRows.map((w) => (
            <div
              key={w.id}
              className="rounded-xl border border-brand-border bg-brand-cardBg p-4 hover:border-brand-violet/50 transition"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-brand-textActive">{w.name}</div>
                <div className="text-xs text-brand-textMuted">
                  {w.registeredVoters?.toLocaleString() ?? 'N/A'} voters
                </div>
              </div>
              <div className="mt-2 text-xs text-brand-textMuted">
                Coverage: <span className="text-brand-textActive">{w.coveragePercent ?? '—'}%</span>
                {w.topIssueCategory && (
                  <>
                    {' '}· Top issue:{' '}
                    <span className="text-brand-textActive">
                      {ISSUE_LABEL[w.topIssueCategory] ?? w.topIssueCategory}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming activities */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-textMuted uppercase tracking-wider">
            Upcoming activities
          </h2>
          <span className="text-xs text-brand-textMuted">
            {summary.upcomingActivities.length} scheduled
          </span>
        </div>
        {summary.upcomingActivities.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-cardBg p-6 text-sm text-brand-textMuted">
            No upcoming activities in scope.
          </div>
        ) : (
          <div className="space-y-2">
            {summary.upcomingActivities.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-brand-border bg-brand-cardBg p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-textActive">{a.title}</div>
                  <div className="text-xs text-brand-textMuted">
                    {a.type.replace(/_/g, ' ')} · {new Date(a.scheduledAt).toLocaleString('en-KE')}
                  </div>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-textMuted">
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="text-xs text-brand-textMuted pt-4 border-t border-brand-border/60">
        Map, heatmaps, and per-screen drill-downs arrive in subsequent Phase 4 commits.
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: 'danger' | 'warning' }) {
  const valueColor =
    tone === 'danger' ? 'text-brand-danger'
    : tone === 'warning' ? 'text-brand-warning'
    : 'text-brand-textActive';
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}
