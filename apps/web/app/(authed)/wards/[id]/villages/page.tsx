import { villages, villageIssues, communityLeaders, wards } from '@an/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { AddVillageForm } from '@/components/add-village-form';

// /wards/[id]/villages — grid of village TILES. Click a tile to open the village
// and see its people (community leaders / elders) and any reported issues.

// Distinct colour per tile (full class strings for Tailwind JIT).
const VILLAGE_TONES = [
  { bar: 'bg-brand-burnt', head: 'text-brand-burnt', hover: 'hover:border-brand-burnt/50' },
  { bar: 'bg-brand-teal',  head: 'text-brand-teal',  hover: 'hover:border-brand-teal/50' },
  { bar: 'bg-brand-rust',  head: 'text-brand-rust',  hover: 'hover:border-brand-rust/50' },
  { bar: 'bg-brand-brown', head: 'text-brand-brown', hover: 'hover:border-brand-brown/50' },
  { bar: 'bg-brand-olive', head: 'text-brand-olive', hover: 'hover:border-brand-olive/50' },
  { bar: 'bg-brand-gold',  head: 'text-brand-burnt', hover: 'hover:border-brand-gold/60' },
];

export default async function WardVillagesPage({ params }: { params: { id: string } }) {
  const claims = await getServerAuthOrRedirect();
  const wardId = params.id;

  const data = await withRlsTx(claims, async (tx) => {
    const wardRows = await tx.select({ id: wards.id, name: wards.name }).from(wards).where(eq(wards.id, wardId)).limit(1);

    const villageRows = await tx
      .select({ id: villages.id, name: villages.name, section: villages.section, populationEstimate: villages.populationEstimate })
      .from(villages)
      .where(and(eq(villages.wardId, wardId), isNull(villages.deletedAt)))
      .orderBy(villages.section, villages.name);

    const issueCounts = await tx
      .select({ vid: villageIssues.villageId, c: sql<number>`count(*)::int` })
      .from(villageIssues)
      .where(eq(villageIssues.wardId, wardId))
      .groupBy(villageIssues.villageId);

    const leaderCounts = await tx
      .select({ vid: communityLeaders.villageId, c: sql<number>`count(*)::int` })
      .from(communityLeaders)
      .where(and(eq(communityLeaders.wardId, wardId), isNull(communityLeaders.deletedAt)))
      .groupBy(communityLeaders.villageId);

    return { ward: wardRows[0] ?? null, villageRows, issueCounts, leaderCounts };
  });

  if (!data.ward) notFound();

  const issueMap = new Map(data.issueCounts.map((r) => [r.vid, r.c]));
  const leaderMap = new Map(data.leaderCounts.map((r) => [r.vid, r.c]));
  const totalLeaders = data.leaderCounts.reduce((s, r) => s + r.c, 0);

  // Group villages by section (preserving the section-then-name sort). A global
  // tile index keeps the colour cycle continuous across sections.
  const bySection = new Map<string, typeof data.villageRows>();
  for (const v of data.villageRows) {
    const key = v.section ?? 'Unassigned';
    (bySection.get(key) ?? bySection.set(key, []).get(key))!.push(v);
  }
  const sectionGroups = Array.from(bySection.entries());
  let tileIndex = 0;

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="space-y-1">
        <Link href={`/wards/${wardId}`} className="text-xs text-brand-teal hover:underline font-semibold">
          ← {data.ward.name} Ward
        </Link>
        <h1 className="text-2xl font-bold text-brand-textActive">
          Villages <span className="text-brand-burnt">· {data.ward.name}</span>
        </h1>
        <p className="text-sm text-brand-textMuted">
          {data.villageRows.length} village{data.villageRows.length === 1 ? '' : 's'} ·{' '}
          {sectionGroups.length} section{sectionGroups.length === 1 ? '' : 's'} ·{' '}
          {totalLeaders} community leader{totalLeaders === 1 ? '' : 's'}. Tap a village to see its people &amp; issues.
        </p>
        <div className="pt-1">
          <AddVillageForm wardId={wardId} wardName={data.ward.name} />
        </div>
      </header>

      {data.villageRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-borderStrong bg-brand-cardBg/40 p-8 text-center">
          <div className="text-3xl mb-2">🏘️</div>
          <div className="text-sm font-semibold text-brand-textActive">No villages recorded for this ward yet</div>
          <p className="text-xs text-brand-textMuted mt-1">Add one with “+ Add village”.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sectionGroups.map(([section, vs]) => (
            <section key={section} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-brand-burnt">📍 {section}</h2>
                <span className="text-[11px] text-brand-textMuted">· {vs.length} village{vs.length === 1 ? '' : 's'}</span>
                <span className="flex-1 h-px bg-brand-border/60" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {vs.map((v) => {
                  const tone = VILLAGE_TONES[tileIndex++ % VILLAGE_TONES.length];
                  const leaders = leaderMap.get(v.id) ?? 0;
                  const issues = issueMap.get(v.id) ?? 0;
                  return (
                    <Link
                      key={v.id}
                      href={`/wards/${wardId}/villages/${v.id}`}
                      className={`group relative overflow-hidden rounded-2xl border border-brand-border bg-brand-cardBg shadow-sm transition hover:shadow-md hover:-translate-y-0.5 ${tone.hover} flex flex-col aspect-square`}
                    >
                      <div className={`h-1.5 ${tone.bar}`} />
                      <div className="flex-1 flex flex-col items-center justify-center text-center px-3 py-2 gap-2">
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${tone.bar} text-white font-black`}>
                          {v.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <h2 className={`text-sm font-extrabold leading-tight ${tone.head} line-clamp-2`}>{v.name}</h2>
                        <div className="text-[10px] font-semibold text-brand-textMuted">
                          {leaders} leader{leaders === 1 ? '' : 's'}
                          {issues > 0 && <span className="text-brand-rust"> · {issues} issue{issues === 1 ? '' : 's'}</span>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
