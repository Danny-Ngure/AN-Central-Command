import { villageIssues, villages, wards } from '@an/db';
import { desc } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

const ISSUE_LABEL: Record<string, string> = {
  water: 'Water supply', sanitation: 'Sanitation', garbage: 'Garbage',
  drainage: 'Drainage / flooding', roads: 'Roads', street_lighting: 'Street lighting',
  electricity: 'Electricity', security: 'Security',
  drugs_substance_abuse: 'Drug / substance abuse', gbv: 'Gender-based violence',
  youth_unemployment: 'Youth unemployment', education: 'Education',
  healthcare: 'Healthcare', land_disputes: 'Land disputes', housing: 'Affordable housing',
  business_permits: 'Business permits', agriculture: 'Agriculture', fishing: 'Fishing',
  environmental: 'Environmental', corruption: 'Corruption',
  service_delivery: 'Service delivery', other: 'Other',
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-brand-danger/20 text-brand-danger border-brand-danger/40',
  serious:  'bg-brand-warning/20 text-brand-warning border-brand-warning/40',
  moderate: 'bg-brand-skyblue/20 text-brand-skyblue border-brand-skyblue/40',
  minor:    'bg-brand-textMuted/10 text-brand-textMuted border-brand-textMuted/30',
};

const STATUS_STYLE: Record<string, string> = {
  reported: 'text-brand-danger',
  investigating: 'text-brand-warning',
  resolved: 'text-emerald-500',
  dismissed: 'text-brand-textMuted',
};

export default async function IssuesPage({ searchParams }: { searchParams: { ward?: string } }) {
  const claims = await getServerAuthOrRedirect();
  const wardFilter = searchParams.ward ?? null;

  const data = await withRlsTx(claims, async (tx) => {
    const allIssues = await tx
      .select({
        id: villageIssues.id,
        category: villageIssues.category,
        title: villageIssues.title,
        severity: villageIssues.severity,
        status: villageIssues.status,
        verified: villageIssues.verified,
        affectsEstimatedVoters: villageIssues.affectsEstimatedVoters,
        wardId: villageIssues.wardId,
        villageId: villageIssues.villageId,
        lastVerifiedAt: villageIssues.lastVerifiedAt,
        createdAt: villageIssues.createdAt,
      })
      .from(villageIssues)
      .orderBy(desc(villageIssues.createdAt));

    // Optional ward scoping via ?ward=<id> (on top of RLS). Used by the Wards menu.
    const issueRows = wardFilter ? allIssues.filter((i) => i.wardId === wardFilter) : allIssues;

    const wardMap = new Map((await tx.select({ id: wards.id, name: wards.name }).from(wards)).map((w) => [w.id, w.name]));
    const villageMap = new Map((await tx.select({ id: villages.id, name: villages.name }).from(villages)).map((v) => [v.id, v.name]));

    const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 } as Record<string, number>;
    for (const i of issueRows) {
      if (i.status === 'reported' || i.status === 'investigating') {
        bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
      }
    }

    return { issueRows, wardMap, villageMap, bySeverity, wardFilterName: wardFilter ? wardMap.get(wardFilter) ?? null : null };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">
          Issue Tracker
          {data.wardFilterName && <span className="text-brand-burnt"> · {data.wardFilterName}</span>}
        </h1>
        <p className="text-sm text-brand-textMuted">
          Village-level grievances. Scoped to your authorised wards.
          {data.wardFilterName && (
            <>
              {' '}<a href="/issues" className="text-brand-teal hover:underline font-semibold">Show all wards</a>
            </>
          )}
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'serious', 'moderate', 'minor'] as const).map((sev) => (
          <div key={sev} className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
            <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">
              Open {sev}
            </div>
            <div className={`mt-1 text-2xl font-bold ${SEVERITY_STYLE[sev].split(' ')[1]}`}>
              {data.bySeverity[sev]}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/10 border-b border-brand-border">
            <tr className="text-left text-xs uppercase tracking-wider text-brand-textMuted">
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Ward · Village</th>
              <th className="px-4 py-3 font-semibold text-right">Affected</th>
            </tr>
          </thead>
          <tbody>
            {data.issueRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-textMuted">
                  No issues visible at your access level.
                </td>
              </tr>
            ) : (
              data.issueRows.map((i) => (
                <tr key={i.id} className="border-b border-brand-border/40 hover:bg-black/20 transition">
                  <td className="px-4 py-3 text-brand-textActive">
                    {i.title}
                    {!i.verified && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-warning">
                        unverified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brand-textMuted">
                    {ISSUE_LABEL[i.category] ?? i.category}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wider font-bold border rounded px-2 py-0.5 ${SEVERITY_STYLE[i.severity]}`}>
                      {i.severity}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs uppercase tracking-wider font-semibold ${STATUS_STYLE[i.status]}`}>
                    {i.status}
                  </td>
                  <td className="px-4 py-3 text-brand-textMuted">
                    {data.wardMap.get(i.wardId) ?? '—'}
                    {' · '}
                    {data.villageMap.get(i.villageId) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-brand-textMuted">
                    {i.affectsEstimatedVoters?.toLocaleString() ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
