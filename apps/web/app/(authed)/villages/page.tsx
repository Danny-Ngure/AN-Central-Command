import Link from 'next/link';
import { asc, eq, isNull, sql } from 'drizzle-orm';
import { villages, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { AllVillagesMap } from '@/components/map/all-villages-map';

// /villages — constituency-wide village map. Every village across all wards,
// clickable to its profile. Ward cards above show how big each ward is by
// village count.

export default async function VillagesIndexPage() {
  const claims = await getServerAuthOrRedirect();

  const wardRows = await withRlsTx(claims, async (tx) =>
    tx
      .select({ id: wards.id, name: wards.name, count: sql<number>`count(${villages.id})::int` })
      .from(wards)
      .leftJoin(villages, sql`${villages.wardId} = ${wards.id} AND ${villages.deletedAt} IS NULL`)
      .groupBy(wards.id, wards.name)
      .orderBy(asc(wards.name)),
  );

  const total = wardRows.reduce((s, w) => s + Number(w.count), 0);
  const sorted = [...wardRows].sort((a, b) => Number(b.count) - Number(a.count));
  const maxCount = Math.max(...wardRows.map((w) => Number(w.count)), 1);

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Villages <span className="text-brand-burnt">· {total}</span></h1>
        <p className="text-sm text-brand-textMuted">
          Every village across Nyali&apos;s 5 wards. Tap a village on the map to open its profile (sites, leaders, team &amp; issues).
        </p>
      </header>

      {/* Ward size cards — how big each ward is by number of villages */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {sorted.map((w) => {
          const c = Number(w.count);
          return (
            <Link
              key={w.id}
              href={`/wards/${w.id}/villages`}
              className="group rounded-xl border border-brand-border bg-brand-cardBg p-4 hover:border-brand-burnt/60 hover:shadow-brand-orange transition"
            >
              <div className="text-2xl font-extrabold text-brand-burnt tabular-nums">{c}</div>
              <div className="text-sm font-bold text-brand-textActive group-hover:text-brand-burnt transition">{w.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-brand-textMuted">villages</div>
              <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div className="h-full bg-brand-burnt" style={{ width: `${(c / maxCount) * 100}%` }} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Constituency-wide clickable map */}
      <AllVillagesMap />
    </div>
  );
}
