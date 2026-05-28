import { pollingStations, wards } from '@an/db';
import { eq } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

// Pollings & Analysis (SRS FR-070 to FR-072).
//
// Full deliverable includes electoral history charts (2013/2017/2022), demographics,
// and current race intelligence. This first version surfaces the raw polling station
// table — historical turnouts and 2022 margins are the rawest signal a strategist
// needs before charts and heatmaps land in a follow-up commit.

export default async function AnalyticsPage() {
  const claims = await getServerAuthOrRedirect();

  const data = await withRlsTx(claims, async (tx) => {
    const stationRows = await tx
      .select({
        id: pollingStations.id,
        iebcCode: pollingStations.iebcCode,
        name: pollingStations.name,
        wardId: pollingStations.wardId,
        registeredVoters: pollingStations.registeredVoters,
        turnout2013: pollingStations.turnout2013,
        turnout2017: pollingStations.turnout2017,
        turnout2022: pollingStations.turnout2022,
        margin2022: pollingStations.margin2022,
        targetTurnout: pollingStations.targetTurnout,
      })
      .from(pollingStations)
      .orderBy(pollingStations.iebcCode);

    const wardRows = await tx
      .select({
        id: wards.id,
        name: wards.name,
        registeredVoters: wards.registeredVoters,
      })
      .from(wards)
      .orderBy(wards.name);

    const wardMap = new Map(wardRows.map((w) => [w.id, w.name]));

    // Ward-level turnout averages across the three cycles.
    const wardSummary = wardRows.map((w) => {
      const stations = stationRows.filter((s) => s.wardId === w.id);
      const avg = (key: 'turnout2013' | 'turnout2017' | 'turnout2022') => {
        const vals = stations.map((s) => s[key]).filter((v): v is number => v != null);
        return vals.length === 0 ? null : Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      };
      const totalMargin2022 = stations.reduce((sum, s) => sum + (s.margin2022 ?? 0), 0);
      return {
        ...w,
        turnout2013: avg('turnout2013'),
        turnout2017: avg('turnout2017'),
        turnout2022: avg('turnout2022'),
        stationCount: stations.length,
        totalMargin2022,
      };
    });

    return { stationRows, wardMap, wardSummary };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Pollings & Analysis</h1>
        <p className="text-sm text-brand-textMuted">
          Historical electoral performance and 2027 targets. Heatmaps and demographic
          overlays arrive in a subsequent commit.
        </p>
      </header>

      {/* Ward-level summary */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
          Ward summary
        </h2>
        <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/40 border-b border-brand-border">
              <tr className="text-left text-xs uppercase tracking-wider text-brand-textMuted">
                <th className="px-4 py-3 font-semibold">Ward</th>
                <th className="px-4 py-3 font-semibold text-right">Voters</th>
                <th className="px-4 py-3 font-semibold text-right">Stations</th>
                <th className="px-4 py-3 font-semibold text-right">2013</th>
                <th className="px-4 py-3 font-semibold text-right">2017</th>
                <th className="px-4 py-3 font-semibold text-right">2022</th>
                <th className="px-4 py-3 font-semibold text-right">2022 margin</th>
              </tr>
            </thead>
            <tbody>
              {data.wardSummary.map((w) => (
                <tr key={w.id} className="border-b border-brand-border/40">
                  <td className="px-4 py-3 font-medium text-brand-textActive">{w.name}</td>
                  <td className="px-4 py-3 text-right text-brand-textMuted">
                    {w.registeredVoters?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-brand-textMuted">{w.stationCount}</td>
                  <td className="px-4 py-3 text-right text-brand-textMuted">
                    {w.turnout2013 != null ? `${w.turnout2013}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-brand-textMuted">
                    {w.turnout2017 != null ? `${w.turnout2017}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-brand-textMuted">
                    {w.turnout2022 != null ? `${w.turnout2022}%` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${w.totalMargin2022 >= 0 ? 'text-emerald-400' : 'text-brand-danger'}`}>
                    {w.totalMargin2022 >= 0 ? '+' : ''}{w.totalMargin2022.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Polling station table */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
          Polling stations ({data.stationRows.length})
        </h2>
        <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/40 border-b border-brand-border">
              <tr className="text-left text-xs uppercase tracking-wider text-brand-textMuted">
                <th className="px-4 py-3 font-semibold">IEBC</th>
                <th className="px-4 py-3 font-semibold">Station</th>
                <th className="px-4 py-3 font-semibold">Ward</th>
                <th className="px-4 py-3 font-semibold text-right">Voters</th>
                <th className="px-4 py-3 font-semibold text-right">13/17/22</th>
                <th className="px-4 py-3 font-semibold text-right">2022 margin</th>
                <th className="px-4 py-3 font-semibold text-right">2027 target</th>
              </tr>
            </thead>
            <tbody>
              {data.stationRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-brand-textMuted">
                    No stations visible.
                  </td>
                </tr>
              ) : (
                data.stationRows.map((s) => (
                  <tr key={s.id} className="border-b border-brand-border/40 hover:bg-black/20 transition">
                    <td className="px-4 py-3 text-brand-textMuted font-mono text-xs">{s.iebcCode}</td>
                    <td className="px-4 py-3 text-brand-textActive">{s.name}</td>
                    <td className="px-4 py-3 text-brand-textMuted">{data.wardMap.get(s.wardId) ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-brand-textMuted">
                      {s.registeredVoters.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-textMuted text-xs">
                      {s.turnout2013 ?? '—'}% / {s.turnout2017 ?? '—'}% / {s.turnout2022 ?? '—'}%
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${(s.margin2022 ?? 0) >= 0 ? 'text-emerald-400' : 'text-brand-danger'}`}>
                      {(s.margin2022 ?? 0) >= 0 ? '+' : ''}{s.margin2022?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-cyan font-semibold">
                      {s.targetTurnout ?? '—'}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
