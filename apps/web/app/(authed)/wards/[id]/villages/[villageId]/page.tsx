import { villages, villageIssues, communityLeaders, wards } from '@an/db';
import { and, eq, isNull, desc } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { PhoneActions } from '@/components/phone-actions';

// /wards/[id]/villages/[villageId] — one village: its people (community leaders /
// elders) and any reported issues.

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
  critical: 'bg-brand-danger/15 text-brand-danger border-brand-danger/40',
  serious:  'bg-brand-rust/15 text-brand-rust border-brand-rust/40',
  moderate: 'bg-brand-teal/15 text-brand-teal border-brand-teal/40',
  minor:    'bg-brand-textMuted/10 text-brand-textMuted border-brand-textMuted/30',
};

export default async function VillagePage({ params }: { params: { id: string; villageId: string } }) {
  const claims = await getServerAuthOrRedirect();
  const { id: wardId, villageId } = params;

  const data = await withRlsTx(claims, async (tx) => {
    const villageRows = await tx
      .select({ id: villages.id, name: villages.name, wardId: villages.wardId, populationEstimate: villages.populationEstimate })
      .from(villages)
      .where(eq(villages.id, villageId))
      .limit(1);
    const village = villageRows[0] ?? null;
    if (!village) return { ward: null, village: null, leaders: [], issues: [] };

    const wardRows = await tx.select({ id: wards.id, name: wards.name }).from(wards).where(eq(wards.id, village.wardId)).limit(1);

    const leaders = await tx
      .select({ id: communityLeaders.id, fullName: communityLeaders.fullName, roleTitle: communityLeaders.roleTitle, phone: communityLeaders.phone })
      .from(communityLeaders)
      .where(and(eq(communityLeaders.villageId, villageId), isNull(communityLeaders.deletedAt)))
      .orderBy(communityLeaders.fullName);

    const issues = await tx
      .select({ id: villageIssues.id, category: villageIssues.category, title: villageIssues.title, severity: villageIssues.severity, status: villageIssues.status })
      .from(villageIssues)
      .where(eq(villageIssues.villageId, villageId))
      .orderBy(desc(villageIssues.createdAt));

    return { ward: wardRows[0] ?? null, village, leaders, issues };
  });

  if (!data.village) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-1">
        <Link href={`/wards/${wardId}/villages`} className="text-xs text-brand-teal hover:underline font-semibold">
          ← Villages{data.ward ? ` · ${data.ward.name}` : ''}
        </Link>
        <h1 className="text-2xl font-bold text-brand-textActive">{data.village.name}</h1>
        <p className="text-sm text-brand-textMuted">
          {data.leaders.length} community leader{data.leaders.length === 1 ? '' : 's'} ·{' '}
          {data.issues.length} issue{data.issues.length === 1 ? '' : 's'}
          {data.village.populationEstimate != null && <> · ~{data.village.populationEstimate.toLocaleString()} people</>}
        </p>
      </header>

      {/* People in this village */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand-burnt uppercase tracking-wide">Community Leaders &amp; Elders</h2>
        {data.leaders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-borderStrong bg-brand-cardBg/40 p-6 text-center text-sm text-brand-textMuted">
            No community leaders recorded for this village yet.
          </div>
        ) : (
          <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden grid grid-cols-1 sm:grid-cols-2">
            {data.leaders.map((l) => {
              const initials = l.fullName.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
              return (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-r border-brand-border/30 hover:bg-black/[0.03] transition">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-brand-teal/15 text-brand-teal flex items-center justify-center text-[11px] font-bold">{initials}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-brand-textActive truncate">{l.fullName}</div>
                    <div className="text-[11px] text-brand-textMuted truncate">{l.roleTitle}{l.phone ? ` · ${l.phone}` : ''}</div>
                  </div>
                  {l.phone && <PhoneActions phone={l.phone} size="sm" />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Issues in this village */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand-rust uppercase tracking-wide">Issues &amp; Problems</h2>
        {data.issues.length === 0 ? (
          <p className="text-sm text-brand-textMuted italic">No issues reported in this village.</p>
        ) : (
          <div className="space-y-2">
            {data.issues.map((iss) => (
              <div key={iss.id} className="rounded-lg border border-brand-border bg-brand-cardBg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-brand-textActive">{iss.title}</div>
                  <div className="mt-0.5 text-xs text-brand-textMuted">{ISSUE_LABEL[iss.category] ?? iss.category}</div>
                </div>
                <span className={`shrink-0 text-[10px] uppercase tracking-wider font-bold border rounded px-2 py-0.5 ${SEVERITY_STYLE[iss.severity]}`}>
                  {iss.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
