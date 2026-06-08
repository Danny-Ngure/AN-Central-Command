import { communityLeaders, communitySites, villages, wards } from '@an/db';
import { eq, isNull } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { AddLeaderForm } from '@/components/add-leader-form';

const LEAN_STYLE: Record<string, string> = {
  supportive: 'text-emerald-500',
  leaning_supportive: 'text-emerald-400',
  neutral: 'text-brand-textMuted',
  leaning_opposition: 'text-brand-orange',
  opposition: 'text-brand-danger',
  unknown: 'text-brand-textMuted',
};

const TEMP_STYLE: Record<string, string> = {
  warm: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  cool: 'bg-brand-skyblue/10 border-brand-skyblue/30 text-brand-skyblue',
  cold: 'bg-brand-textMuted/10 border-brand-textMuted/30 text-brand-textMuted',
  hostile: 'bg-brand-danger/10 border-brand-danger/30 text-brand-danger',
  not_approached: 'bg-brand-orange/10 border-brand-orange/30 text-brand-orange',
};

const SITE_TYPE_LABEL: Record<string, string> = {
  mosque: 'Mosque', church: 'Church', madrasa: 'Madrasa',
  school_primary: 'Primary school', school_secondary: 'Secondary school',
  market: 'Market', shopping_center: 'Shopping centre',
  boda_stage: 'Boda stage', matatu_stage: 'Matatu stage',
  chama: 'Chama', sacco: 'SACCO', self_help_group: 'Self-help group',
  community_hall: 'Community hall', social_hall: 'Social hall',
  health_facility: 'Health facility', government_office: 'Govt office',
};

const HAS_NOTES_ACCESS = new Set(['candidate', 'campaign_manager', 'chief_strategist']);

export default async function CommunityPage({ searchParams }: { searchParams: { ward?: string } }) {
  const claims = await getServerAuthOrRedirect();
  const wardFilter = searchParams.ward ?? null;

  const data = await withRlsTx(claims, async (tx) => {
    const allLeaders = await tx
      .select()
      .from(communityLeaders)
      .where(isNull(communityLeaders.deletedAt))
      .orderBy(communityLeaders.fullName);

    const allSites = await tx
      .select()
      .from(communitySites)
      .where(isNull(communitySites.deletedAt))
      .orderBy(communitySites.name);

    // Optional ward scoping via ?ward=<id> (on top of RLS). Used by the Wards menu.
    const leaderRows = wardFilter ? allLeaders.filter((l) => l.wardId === wardFilter) : allLeaders;
    const siteRows = wardFilter ? allSites.filter((s) => s.wardId === wardFilter) : allSites;

    const wardList = await tx.select({ id: wards.id, name: wards.name }).from(wards).orderBy(wards.name);
    const wardMap = new Map(wardList.map((w) => [w.id, w.name]));
    const villageList = await tx
      .select({ id: villages.id, name: villages.name, wardId: villages.wardId })
      .from(villages)
      .where(isNull(villages.deletedAt))
      .orderBy(villages.name);
    const villageMap = new Map(villageList.map((v) => [v.id, v.name]));

    const queuedCount = leaderRows.filter((l) => l.isQueuedForReview).length;

    return { leaderRows, siteRows, wardMap, villageMap, wardList, villageList, queuedCount, wardFilterName: wardFilter ? wardMap.get(wardFilter) ?? null : null };
  });

  const showNotes = HAS_NOTES_ACCESS.has(claims.role);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">
          Community Leaders
          {data.wardFilterName && <span className="text-brand-burnt"> · {data.wardFilterName}</span>}
        </h1>
        <p className="text-sm text-brand-textMuted">
          Community leaders and gathering sites in your authorised wards.
          {data.wardFilterName && (
            <>
              {' '}<a href="/community" className="text-brand-teal hover:underline font-semibold">Show all wards</a>.
            </>
          )}
          {data.queuedCount > 0 && (
            <span className="ml-2 text-brand-teal">
              {data.queuedCount} pending review.
            </span>
          )}
        </p>
        <div className="pt-1">
          <AddLeaderForm wards={data.wardList} villages={data.villageList} />
        </div>
      </header>

      {/* Leaders */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
          Community Leaders ({data.leaderRows.length})
        </h2>
        {data.leaderRows.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-cardBg p-6 text-sm text-brand-textMuted">
            No community leaders visible at your access level.
          </div>
        ) : (
          <div className="space-y-2">
            {data.leaderRows.map((l) => (
              <div
                key={l.id}
                className="rounded-lg border border-brand-border bg-brand-cardBg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-textActive">{l.fullName}</span>
                      {l.isQueuedForReview && (
                        <span className="text-[10px] uppercase tracking-wider text-brand-cyan border border-brand-cyan/40 rounded px-1.5 py-0.5">
                          pending review
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-brand-textMuted">
                      {l.roleTitle} · {data.villageMap.get(l.villageId) ?? '—'} ·{' '}
                      {data.wardMap.get(l.wardId) ?? '—'}
                    </div>
                    <div className="flex gap-2 flex-wrap mt-2">
                      <span className={`text-[10px] uppercase tracking-wider font-bold ${LEAN_STYLE[l.politicalLean]}`}>
                        {l.politicalLean.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold border rounded px-1.5 py-0.5 ${TEMP_STYLE[l.relationshipTemperature]}`}>
                        {l.relationshipTemperature.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-brand-textMuted">
                        reach: {l.influenceReach}
                      </span>
                    </div>
                    {showNotes && l.sensitiveNotes && (
                      <details className="mt-2">
                        <summary className="text-[10px] uppercase tracking-wider text-brand-violet cursor-pointer">
                          Strategic notes (restricted)
                        </summary>
                        <p className="mt-1 text-xs text-brand-textActive bg-brand-violet/5 border border-brand-violet/20 rounded p-2">
                          {l.sensitiveNotes}
                        </p>
                      </details>
                    )}
                  </div>
                  <div className="text-right text-xs text-brand-textMuted shrink-0">
                    {l.phone && <div>{l.phone}</div>}
                    {l.email && <div className="truncate max-w-[180px]">{l.email}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sites */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
          Community Sites ({data.siteRows.length})
        </h2>
        {data.siteRows.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-cardBg p-6 text-sm text-brand-textMuted">
            No sites visible at your access level.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.siteRows.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-brand-border bg-brand-cardBg p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-brand-textActive truncate">{s.name}</div>
                  <span className="text-[10px] uppercase tracking-wider text-brand-textMuted shrink-0">
                    {SITE_TYPE_LABEL[s.type] ?? s.type}
                  </span>
                </div>
                <div className="mt-1 text-xs text-brand-textMuted">
                  {s.villageId ? data.villageMap.get(s.villageId) : '—'} ·{' '}
                  {data.wardMap.get(s.wardId) ?? '—'}
                  {s.estimatedSize && <> · ~{s.estimatedSize} people</>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
