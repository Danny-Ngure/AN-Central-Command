import { committedSupporters, communityPrograms, pollingStations, wards } from '@an/db';
import { eq, desc } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

// Committed Supporter Network (SRS FR-130 to FR-134) — most-restricted screen in the
// platform. RLS in extras/03 enforces:
//
//   leadership (candidate, campaign_manager, chief_strategist, constituency_coordinator)
//     → see all supporters across the constituency
//   ward_coordinator, assistant_ward_coordinator
//     → see only their ward's supporters
//   canvasser
//     → see only supporters they personally registered
//   everyone else (polling_agent, finance_lead, patron_ceo, etc.)
//     → empty result set
//
// The UI doesn't try to detect or message "you have no access" vs "your scope has no
// supporters" — that's the SRS 404-not-403 pattern (ERR-130.2). An empty result is just
// an empty result; the caller can't distinguish.

const TIER_LABEL: Record<string, string> = {
  strong_commit: 'Strong commit',
  likely: 'Likely',
  probable: 'Probable',
  unverified: 'Unverified',
};

const TIER_STYLE: Record<string, string> = {
  strong_commit: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  likely: 'bg-brand-skyblue/15 text-brand-skyblue border-brand-skyblue/30',
  probable: 'bg-brand-orange/15 text-brand-orange border-brand-orange/30',
  unverified: 'bg-brand-textMuted/10 text-brand-textMuted border-brand-textMuted/20',
};

export default async function SupportersPage() {
  const claims = await getServerAuthOrRedirect();

  const data = await withRlsTx(claims, async (tx) => {
    const supporterRows = await tx
      .select({
        id: committedSupporters.id,
        fullName: committedSupporters.fullName,
        nationalIdMasked: committedSupporters.nationalIdMasked,
        phone: committedSupporters.phone,
        pollingStationId: committedSupporters.pollingStationId,
        wardId: committedSupporters.wardId,
        communityProgramId: committedSupporters.communityProgramId,
        commitmentTier: committedSupporters.commitmentTier,
        consentCaptureMethod: committedSupporters.consentCaptureMethod,
        consentCapturedAt: committedSupporters.consentCapturedAt,
        lastVerifiedDate: committedSupporters.lastVerifiedDate,
        registeringPersonId: committedSupporters.registeringPersonId,
        withdrawn: committedSupporters.withdrawn,
      })
      .from(committedSupporters)
      .where(eq(committedSupporters.withdrawn, false))
      .orderBy(desc(committedSupporters.consentCapturedAt));

    const wardMap = new Map((await tx.select({ id: wards.id, name: wards.name }).from(wards)).map((w) => [w.id, w.name]));
    const stationMap = new Map((await tx.select({ id: pollingStations.id, name: pollingStations.name }).from(pollingStations)).map((s) => [s.id, s.name]));
    const programMap = new Map((await tx.select({ id: communityPrograms.id, name: communityPrograms.name }).from(communityPrograms)).map((p) => [p.id, p.name]));

    const byTier = { strong_commit: 0, likely: 0, probable: 0, unverified: 0 } as Record<string, number>;
    for (const s of supporterRows) byTier[s.commitmentTier] = (byTier[s.commitmentTier] ?? 0) + 1;

    // Stale = lastVerifiedDate more than 90 days ago (FR-133).
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const staleCount = supporterRows.filter((s) => new Date(s.lastVerifiedDate) < ninetyDaysAgo).length;

    return { supporterRows, wardMap, stationMap, programMap, byTier, staleCount };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-brand-textActive">Supporter Network</h1>
          <span className="text-[10px] uppercase tracking-wider text-brand-violet border border-brand-violet/40 rounded px-2 py-0.5">
            RESTRICTED
          </span>
        </div>
        <p className="text-sm text-brand-textMuted">
          Voters with documented support commitments. Sensitive personal data — see
          docs/conventions.md and SRS COMP-010 for the full handling rules.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['strong_commit', 'likely', 'probable', 'unverified'] as const).map((tier) => (
          <div key={tier} className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
            <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">
              {TIER_LABEL[tier]}
            </div>
            <div className="mt-1 text-2xl font-bold text-brand-textActive">
              {data.byTier[tier]}
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
          <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">
            Stale (90d)
          </div>
          <div className={`mt-1 text-2xl font-bold ${data.staleCount > 0 ? 'text-brand-warning' : 'text-brand-textActive'}`}>
            {data.staleCount}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/10 border-b border-brand-border">
            <tr className="text-left text-xs uppercase tracking-wider text-brand-textMuted">
              <th className="px-4 py-3 font-semibold">Voter</th>
              <th className="px-4 py-3 font-semibold">Tier</th>
              <th className="px-4 py-3 font-semibold">Ward · Station</th>
              <th className="px-4 py-3 font-semibold">Program</th>
              <th className="px-4 py-3 font-semibold">Consent</th>
              <th className="px-4 py-3 font-semibold">Verified</th>
            </tr>
          </thead>
          <tbody>
            {data.supporterRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-textMuted">
                  No supporters visible at your access level.
                </td>
              </tr>
            ) : (
              data.supporterRows.map((s) => (
                <tr key={s.id} className="border-b border-brand-border/40 hover:bg-black/20 transition">
                  <td className="px-4 py-3">
                    <div className="text-brand-textActive font-medium">{s.fullName}</div>
                    <div className="text-xs text-brand-textMuted">
                      {s.nationalIdMasked ?? '—'}{s.phone && <> · {s.phone}</>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wider font-bold border rounded px-2 py-0.5 ${TIER_STYLE[s.commitmentTier]}`}>
                      {TIER_LABEL[s.commitmentTier]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brand-textMuted">
                    {data.wardMap.get(s.wardId) ?? '—'}
                    <div className="text-xs">
                      {data.stationMap.get(s.pollingStationId) ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-textMuted">
                    {data.programMap.get(s.communityProgramId) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-brand-textMuted text-xs">
                    <div>{s.consentCaptureMethod.replace(/_/g, ' ')}</div>
                    <div className="text-brand-textMuted/60">
                      {new Date(s.consentCapturedAt).toLocaleDateString('en-KE')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-textMuted text-xs">
                    {new Date(s.lastVerifiedDate).toLocaleDateString('en-KE')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-brand-textMuted">
        Every read of this page is recorded in <code>audit_log</code> for the monthly
        access audit (SRS AUD-130.3). Withdrawal of consent and right-to-erasure flows
        land in a follow-up commit.
      </p>
    </div>
  );
}
