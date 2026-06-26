import { roads, villages, wards } from '@an/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

// /roads — the MP's road projects, listed village → village. Add form + per-ward
// list. Roads aren't sourced automatically (not in any open dataset at this
// granularity) — this is where the team records the real projects.

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-brand-success/15 text-brand-success border-brand-success/40',
  ongoing:   'bg-brand-skyBlue/15 text-brand-skyBlue border-brand-skyBlue/40',
  proposed:  'bg-brand-gold/15 text-brand-burnt border-brand-gold/50',
  stalled:   'bg-brand-danger/15 text-brand-danger border-brand-danger/40',
};
const FUNDING_LABEL: Record<string, string> = {
  ng_cdf: 'NG-CDF', county: 'County', national: 'National', other: 'Other',
};

export default async function RoadsPage({ searchParams }: { searchParams: { roadCreated?: string; roadError?: string; ward?: string } }) {
  const claims = await getServerAuthOrRedirect();

  const data = await withRlsTx(claims, async (tx) => {
    const wardRows = await tx.select({ id: wards.id, name: wards.name }).from(wards).orderBy(asc(wards.name));
    const villageRows = await tx
      .select({ id: villages.id, name: villages.name, wardId: villages.wardId })
      .from(villages).where(isNull(villages.deletedAt)).orderBy(asc(villages.name));
    const roadRows = await tx
      .select({
        id: roads.id, name: roads.name, wardId: roads.wardId, status: roads.status,
        funding: roads.funding, surface: roads.surface, lengthKm: roads.lengthKm,
        fromVillageId: roads.fromVillageId, toVillageId: roads.toVillageId, mpProject: roads.mpProject, notes: roads.notes,
      })
      .from(roads).where(isNull(roads.deletedAt)).orderBy(asc(roads.name));
    return { wardRows, villageRows, roadRows };
  });

  const wardName = new Map(data.wardRows.map((w) => [w.id, w.name]));
  const villageName = new Map(data.villageRows.map((v) => [v.id, v.name]));
  const byWard = new Map<string, typeof data.roadRows>();
  data.roadRows.forEach((r) => {
    const k = r.wardId ?? 'none';
    if (!byWard.has(k)) byWard.set(k, []);
    byWard.get(k)!.push(r);
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Roads <span className="text-brand-burnt">· MP projects</span></h1>
        <p className="text-sm text-brand-textMuted">
          {data.roadRows.length} road{data.roadRows.length === 1 ? '' : 's'} recorded, village → village. Add the MP / NG-CDF projects as you confirm them.
        </p>
      </header>

      {searchParams.roadCreated && <div className="rounded-lg border border-brand-success/50 bg-brand-success/10 px-4 py-2 text-sm text-brand-success">✓ Road added.</div>}
      {searchParams.roadError && <div className="rounded-lg border border-brand-danger/50 bg-brand-danger/10 px-4 py-2 text-sm text-brand-danger">{searchParams.roadError}</div>}

      {/* Add form */}
      <form method="post" action="/api/roads/create" className="rounded-xl border border-brand-border bg-brand-cardBg p-4 space-y-3">
        <div className="text-sm font-bold text-brand-textActive">Add a road</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Road name *"><input name="name" required maxLength={200} placeholder="e.g. Kongowea–Kambi Kikuyu road" className={INPUT} /></Field>
          <Field label="Ward">
            <select name="wardId" className={INPUT}>
              <option value="">— select ward —</option>
              {data.wardRows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="From village">
            <select name="fromVillageId" className={INPUT}>
              <option value="">— start —</option>
              {data.villageRows.map((v) => <option key={v.id} value={v.id}>{v.name} ({wardName.get(v.wardId) ?? ''})</option>)}
            </select>
          </Field>
          <Field label="To village">
            <select name="toVillageId" className={INPUT}>
              <option value="">— end —</option>
              {data.villageRows.map((v) => <option key={v.id} value={v.id}>{v.name} ({wardName.get(v.wardId) ?? ''})</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" className={INPUT}>
              <option value="">—</option><option value="proposed">Proposed</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="stalled">Stalled</option>
            </select>
          </Field>
          <Field label="Funding">
            <select name="funding" className={INPUT}>
              <option value="">—</option><option value="ng_cdf">NG-CDF</option><option value="county">County</option><option value="national">National</option><option value="other">Other</option>
            </select>
          </Field>
          <Field label="Surface">
            <select name="surface" className={INPUT}>
              <option value="">—</option><option value="tarmac">Tarmac</option><option value="cabro">Cabro</option><option value="murram">Murram</option><option value="graded">Graded</option><option value="earth">Earth</option>
            </select>
          </Field>
          <Field label="Length (km)"><input name="lengthKm" type="number" step="0.1" min="0" className={INPUT} /></Field>
        </div>
        <Field label="Notes"><textarea name="notes" rows={2} maxLength={1000} className={INPUT} /></Field>
        <label className="flex items-center gap-2 text-xs text-brand-textBody">
          <input type="checkbox" name="mpProject" defaultChecked className="accent-brand-orangeBright" /> This is an MP project
        </label>
        <button className="px-4 py-2 rounded-md bg-brand-orangePrimary text-white text-sm font-bold uppercase tracking-wider hover:bg-brand-orangeBright transition">Add road</button>
      </form>

      {/* List by ward */}
      {data.roadRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-brand-cardBg p-8 text-center text-sm text-brand-textMuted">
          No roads recorded yet. Add the MP&apos;s road projects above.
        </div>
      ) : (
        Array.from(byWard.entries()).map(([wardId, rs]) => (
          <section key={wardId} className="space-y-2">
            <h2 className="text-sm font-bold text-brand-burnt uppercase tracking-wide">{wardId === 'none' ? 'Unassigned ward' : (wardName.get(wardId) ?? 'Ward')} · {rs.length}</h2>
            <div className="space-y-2">
              {rs.map((r) => (
                <div key={r.id} className="rounded-lg border border-brand-border bg-brand-cardBg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-brand-textActive">{r.name}</div>
                      <div className="text-xs text-brand-textMuted mt-0.5">
                        {r.fromVillageId && villageName.get(r.fromVillageId)}
                        {r.fromVillageId && r.toVillageId && ' → '}
                        {r.toVillageId && villageName.get(r.toVillageId)}
                        {r.lengthKm && <span> · {r.lengthKm} km</span>}
                        {r.surface && <span> · {r.surface}</span>}
                      </div>
                      {r.notes && <div className="text-xs text-brand-textBody mt-1">{r.notes}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {r.status && <span className={`text-[10px] uppercase font-bold border rounded px-2 py-0.5 ${STATUS_STYLE[r.status] ?? 'border-brand-border text-brand-textMuted'}`}>{r.status}</span>}
                      {r.funding && <span className="text-[10px] uppercase font-bold text-brand-teal">{FUNDING_LABEL[r.funding] ?? r.funding}</span>}
                      {r.mpProject && <span className="text-[10px] uppercase font-bold text-brand-orangeBright">MP</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

const INPUT = 'w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider font-bold text-brand-textMuted mb-1">{label}</label>
      {children}
    </div>
  );
}
