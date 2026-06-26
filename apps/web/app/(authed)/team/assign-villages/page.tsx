import { people, villages, wards } from '@an/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

// /team/assign-villages — set which village each team member is based in.
// One tiny <form> per person (a village dropdown scoped to their ward + Save),
// so it works with no client JS. Feeds the "team members based here" section on
// each village page.

export default async function AssignVillagesPage() {
  const claims = await getServerAuthOrRedirect();

  const data = await withRlsTx(claims, async (tx) => {
    const peopleRows = await tx
      .select({ id: people.id, fullName: people.fullName, role: people.role, wardId: people.wardId, homeVillageId: people.homeVillageId })
      .from(people)
      .where(and(eq(people.active, true), isNull(people.deletedAt)))
      .orderBy(asc(people.fullName));
    const wardRows = await tx.select({ id: wards.id, name: wards.name }).from(wards).orderBy(asc(wards.name));
    const villageRows = await tx
      .select({ id: villages.id, name: villages.name, section: villages.section, wardId: villages.wardId })
      .from(villages).where(isNull(villages.deletedAt)).orderBy(asc(villages.section), asc(villages.name));
    return { peopleRows, wardRows, villageRows };
  });

  const wardName = new Map(data.wardRows.map((w) => [w.id, w.name]));
  const villagesByWard = new Map<string, typeof data.villageRows>();
  data.villageRows.forEach((v) => {
    if (!villagesByWard.has(v.wardId)) villagesByWard.set(v.wardId, []);
    villagesByWard.get(v.wardId)!.push(v);
  });
  // People grouped by ward.
  const byWard = new Map<string, typeof data.peopleRows>();
  data.peopleRows.forEach((p) => {
    const key = p.wardId ?? 'none';
    if (!byWard.has(key)) byWard.set(key, []);
    byWard.get(key)!.push(p);
  });
  const assigned = data.peopleRows.filter((p) => p.homeVillageId).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-1">
        <Link href="/team" className="text-xs text-brand-teal hover:underline font-semibold">← Team</Link>
        <h1 className="text-2xl font-bold text-brand-textActive">Assign team members to villages</h1>
        <p className="text-sm text-brand-textMuted">
          {assigned} of {data.peopleRows.length} assigned. Pick each person&apos;s base village and Save — they&apos;ll then show on that village&apos;s page.
        </p>
      </header>

      {Array.from(byWard.entries()).map(([wardId, members]) => {
        const wVillages = villagesByWard.get(wardId) ?? data.villageRows; // no ward → all villages
        return (
          <section key={wardId} className="space-y-2">
            <h2 className="text-sm font-bold text-brand-burnt uppercase tracking-wide">
              {wardId === 'none' ? 'No ward set' : (wardName.get(wardId) ?? 'Ward')} · {members.length}
            </h2>
            <div className="rounded-xl border border-brand-border bg-brand-cardBg divide-y divide-brand-border/40">
              {members.map((p) => (
                <form key={p.id} method="post" action={`/api/team/${p.id}/village`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-brand-textActive truncate">{p.fullName}</div>
                    <div className="text-[11px] text-brand-textMuted">{p.role.replace(/_/g, ' ')}</div>
                  </div>
                  <select name="villageId" defaultValue={p.homeVillageId ?? ''}
                    className="bg-brand-cardBgHeavy border border-brand-border rounded-md px-2 py-1.5 text-xs text-brand-textActive focus:outline-none focus:border-brand-skyBlue min-w-[200px]">
                    <option value="">— not set —</option>
                    {wVillages.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}{v.section ? ` (${v.section})` : ''}</option>
                    ))}
                  </select>
                  <button className="px-3 py-1.5 rounded-md bg-brand-tealBlue text-white text-xs font-semibold hover:bg-brand-tealBright">Save</button>
                </form>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
