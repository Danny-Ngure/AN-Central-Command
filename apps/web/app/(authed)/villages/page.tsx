import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { AllVillagesMap } from '@/components/map/all-villages-map';

// /villages — constituency-wide village coverage. Every village across all wards, with
// a graph-driven read on where we've been and where we haven't: reached vs not-yet per
// ward, the never-visited list, and links into each ward's villages for the detail.

export const dynamic = 'force-dynamic';

// Poll-palette colours (match the Analysis section) — no purple.
const CO = { reached: '#10b981', notyet: '#dc2626', teal: '#025e73', orange: '#ff6600', olive: '#0d4c5c' };

type Row = { id: string; name: string; villages: number; reached: number; unvisited_names: string[] | null };

export default async function VillagesIndexPage() {
  const claims = await getServerAuthOrRedirect();

  const rows = (await withRlsTx(claims, async (tx) =>
    tx.execute(sql`
      SELECT w.id, w.name,
             count(*)::int AS villages,
             count(*) FILTER (WHERE nv.vs > 0)::int AS reached,
             (array_agg(nv.name ORDER BY nv.name) FILTER (WHERE nv.vs = 0))[1:16] AS unvisited_names
      FROM (SELECT v.id, v.ward_id, v.name, count(s.id) FILTER (WHERE s.visited) AS vs
            FROM villages v LEFT JOIN community_sites s ON s.village_id = v.id AND s.deleted_at IS NULL
            WHERE v.deleted_at IS NULL GROUP BY v.id, v.ward_id, v.name) nv
      JOIN wards w ON w.id = nv.ward_id
      GROUP BY w.id, w.name ORDER BY w.name`),
  )) as unknown as Row[];

  const total = rows.reduce((s, w) => s + w.villages, 0);
  const reached = rows.reduce((s, w) => s + w.reached, 0);
  const never = total - reached;
  const reachedPct = total ? Math.round((reached / total) * 100) : 0;
  const maxV = Math.max(...rows.map((w) => w.villages), 1);
  const byReach = [...rows].sort((a, b) => (b.reached / (b.villages || 1)) - (a.reached / (a.villages || 1)));

  return (
    <div className="space-y-7 max-w-6xl">
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/wards/coverage" className="text-xs font-semibold text-brand-aqua hover:text-brand-skyBlue">← Constituency coverage</Link>
        </div>
        <h1 className="text-2xl font-bold text-brand-textActive">Villages <span className="text-brand-burnt">· {total}</span></h1>
        <p className="text-sm text-brand-textMuted">
          Every village across Nyali&apos;s 5 wards — where we&apos;ve been and where we haven&apos;t. Tap a ward for its full village list, or a village on the map for its profile.
        </p>
      </header>

      {/* Coverage KPIs */}
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        <Kpi label="Villages" value={total} tone={CO.teal} />
        <Kpi label="Reached" value={reached} tone={CO.reached} sub={`${reachedPct}%`} />
        <Kpi label="Never visited" value={never} tone={CO.notyet} />
      </div>

      {/* Per-ward coverage cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {byReach.map((w) => {
          const pct = w.villages ? Math.round((w.reached / w.villages) * 100) : 0;
          const notYet = w.villages - w.reached;
          const names = (w.unvisited_names ?? []).filter(Boolean);
          return (
            <div key={w.id} className="rounded-2xl border border-brand-border bg-brand-cardBg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/wards/${w.id}/villages`} className="text-base font-bold text-brand-textActive hover:text-brand-burnt hover:underline">
                  {w.name}
                </Link>
                <span className="text-xs font-bold tabular-nums" style={{ color: pct >= 40 ? CO.reached : CO.notyet }}>
                  {w.reached}/{w.villages} reached · {pct}%
                </span>
              </div>

              {/* Reached vs not-yet split bar */}
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-brand-cardBgHeavy/60">
                <div className="h-full" style={{ width: `${pct}%`, backgroundColor: CO.reached }} title={`${w.reached} reached`} />
                <div className="h-full" style={{ width: `${100 - pct}%`, backgroundColor: CO.notyet, opacity: 0.85 }} title={`${notYet} not visited`} />
              </div>
              {/* size bar (how big the ward is) */}
              <div className="flex items-center gap-2 text-[11px] text-brand-textMuted">
                <span className="w-16 shrink-0">Ward size</span>
                <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(w.villages / maxV) * 100}%`, backgroundColor: CO.orange }} />
                </div>
                <span className="shrink-0 font-bold text-brand-textActive">{w.villages}</span>
              </div>

              {/* Not-yet-visited list */}
              {notYet > 0 && (
                <div className="rounded-lg border border-brand-danger/25 bg-brand-danger/[0.04] p-2.5 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: CO.notyet }}>
                    ⚠ {notYet} not yet visited
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {names.slice(0, 12).map((n) => (
                      <span key={n} className="rounded bg-brand-cardBgHeavy/60 px-1.5 py-0.5 text-[10px] text-brand-textBody">{n}</span>
                    ))}
                    {notYet > names.slice(0, 12).length && (
                      <Link href={`/wards/${w.id}/villages`} className="rounded bg-brand-burnt/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-burnt hover:bg-brand-burnt hover:text-white">
                        see all →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <Link href={`/wards/${w.id}/villages`} className="inline-block rounded-lg border border-brand-borderStrong px-3 py-1.5 text-[11px] font-bold text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt">
                Analyze {w.name} villages →
              </Link>
            </div>
          );
        })}
      </div>

      {/* Constituency-wide clickable map */}
      <AllVillagesMap />
    </div>
  );
}

function Kpi({ label, value, tone, sub }: { label: string; value: number; tone: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-3 text-center">
      <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: tone }}>{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">{label}</div>
      {sub && <div className="text-[10px] text-brand-textMuted">{sub}</div>}
    </div>
  );
}
