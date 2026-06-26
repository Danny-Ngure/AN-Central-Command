import { villages, villageIssues, communityLeaders, communitySites, pollingStations, wards } from '@an/db';
import { and, eq, isNull, desc, asc } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { PhoneActions } from '@/components/phone-actions';

// /wards/[id]/villages/[villageId] — one village, with EVERYTHING in our data that
// sits in it rolled down: community sites (mosques, churches, schools, stages,
// markets, welfare groups…), nearby polling stations, community leaders, issues.
// Sites link by community_sites.village_id (backfilled from area names via
// tools/backfill-site-villages.cjs). Polling stations match by name (best effort).

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

// Site type → icon + the group it shows under.
const SITE_TYPE = {
  mosque: { icon: '🕌', label: 'Mosque' }, madrasa: { icon: '📖', label: 'Madrasa' },
  church: { icon: '⛪', label: 'Church' },
  social_hall: { icon: '🏛️', label: 'Social hall' }, community_hall: { icon: '🏛️', label: 'Community hall' },
  youth_center: { icon: '🧑‍🤝‍🧑', label: 'Youth centre' }, sports_club: { icon: '⚽', label: 'Sports club' },
  boda_stage: { icon: '🏍️', label: 'Boda stage' }, matatu_stage: { icon: '🚐', label: 'Matatu stage' },
  market: { icon: '🛒', label: 'Market' }, shopping_center: { icon: '🏬', label: 'Shopping centre' },
  school_public: { icon: '🏫', label: 'Public school' }, school_private: { icon: '🏫', label: 'Private school' },
  school_secondary: { icon: '🏫', label: 'Secondary school' }, school_primary: { icon: '🏫', label: 'Primary school' },
  school_tertiary: { icon: '🎓', label: 'College' }, school_other: { icon: '🏫', label: 'School' },
  welfare_group: { icon: '🤝', label: 'Welfare group' }, chama: { icon: '💰', label: 'Chama' },
  sacco: { icon: '💳', label: 'SACCO' }, self_help_group: { icon: '🤝', label: 'Self-help group' },
  health_facility: { icon: '🏥', label: 'Health facility' }, government_office: { icon: '🏢', label: 'Govt office' },
  other: { icon: '📍', label: 'Other' },
} as Record<string, { icon: string; label: string }>;
const typeMeta = (t: string) => SITE_TYPE[t] ?? { icon: '📍', label: t.replace(/_/g, ' ') };

const SITE_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Mosques & churches', types: ['mosque', 'madrasa', 'church'] },
  { label: 'Schools', types: ['school_public', 'school_private', 'school_secondary', 'school_primary', 'school_tertiary', 'school_other'] },
  { label: 'Social, youth & sports', types: ['social_hall', 'community_hall', 'youth_center', 'sports_club'] },
  { label: 'Boda & matatu stages', types: ['boda_stage', 'matatu_stage'] },
  { label: 'Markets & shops', types: ['market', 'shopping_center'] },
  { label: 'Welfare groups, chamas & SACCOs', types: ['welfare_group', 'chama', 'sacco', 'self_help_group'] },
  { label: 'Health & government', types: ['health_facility', 'government_office'] },
  { label: 'Other', types: ['other'] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default async function VillagePage({ params }: { params: { id: string; villageId: string } }) {
  const claims = await getServerAuthOrRedirect();
  const { id: wardId, villageId } = params;

  const data = await withRlsTx(claims, async (tx) => {
    const villageRows = await tx
      .select({ id: villages.id, name: villages.name, section: villages.section, wardId: villages.wardId, populationEstimate: villages.populationEstimate })
      .from(villages).where(eq(villages.id, villageId)).limit(1);
    const village = villageRows[0] ?? null;
    if (!village) return { ward: null, village: null, leaders: [], issues: [], sites: [], stations: [] };

    const wardRows = await tx.select({ id: wards.id, name: wards.name }).from(wards).where(eq(wards.id, village.wardId)).limit(1);

    const leaders = await tx
      .select({ id: communityLeaders.id, fullName: communityLeaders.fullName, roleTitle: communityLeaders.roleTitle, phone: communityLeaders.phone })
      .from(communityLeaders)
      .where(and(eq(communityLeaders.villageId, villageId), isNull(communityLeaders.deletedAt)))
      .orderBy(communityLeaders.fullName);

    const issues = await tx
      .select({ id: villageIssues.id, category: villageIssues.category, title: villageIssues.title, severity: villageIssues.severity, status: villageIssues.status })
      .from(villageIssues).where(eq(villageIssues.villageId, villageId)).orderBy(desc(villageIssues.createdAt));

    const sites = await tx
      .select({ id: communitySites.id, name: communitySites.name, type: communitySites.type, visited: communitySites.visited })
      .from(communitySites)
      .where(and(eq(communitySites.villageId, villageId), isNull(communitySites.deletedAt)))
      .orderBy(asc(communitySites.type), asc(communitySites.name));

    // Polling stations: best-effort name match within the ward (no village FK).
    const wardStations = await tx
      .select({ id: pollingStations.id, name: pollingStations.name })
      .from(pollingStations)
      .where(and(eq(pollingStations.wardId, village.wardId), eq(pollingStations.active, true)));
    const vKey = norm(village.name);
    const stations = vKey.length >= 4 ? wardStations.filter((s) => norm(s.name).includes(vKey)) : [];

    return { ward: wardRows[0] ?? null, village, leaders, issues, sites, stations };
  });

  if (!data.village) notFound();

  const grouped = SITE_GROUPS
    .map((g) => ({ ...g, items: data.sites.filter((s) => g.types.includes(s.type)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-1">
        <Link href={`/wards/${wardId}/villages`} className="text-xs text-brand-teal hover:underline font-semibold">
          ← Villages{data.ward ? ` · ${data.ward.name}` : ''}
        </Link>
        <h1 className="text-2xl font-bold text-brand-textActive">{data.village.name}</h1>
        <p className="text-sm text-brand-textMuted">
          {data.village.section && <>📍 {data.village.section} · </>}
          {data.sites.length} site{data.sites.length === 1 ? '' : 's'} ·{' '}
          {data.stations.length} polling station{data.stations.length === 1 ? '' : 's'} ·{' '}
          {data.leaders.length} leader{data.leaders.length === 1 ? '' : 's'} ·{' '}
          {data.issues.length} issue{data.issues.length === 1 ? '' : 's'}
          {data.village.populationEstimate != null && <> · ~{data.village.populationEstimate.toLocaleString()} people</>}
        </p>
      </header>

      {/* Sites in this village — grouped by category */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-brand-teal uppercase tracking-wide">Places &amp; organisations here</h2>
        {grouped.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-borderStrong bg-brand-cardBg/40 p-6 text-center text-sm text-brand-textMuted">
            No sites linked to this village yet. (Sites with an unrecognised area label stay at ward level.)
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.label} className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-textMuted">{g.label} · {g.items.length}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {g.items.map((s) => {
                    const m = typeMeta(s.type);
                    return (
                      <div key={s.id} className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-cardBg px-3 py-2">
                        <span className="text-base shrink-0">{m.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-brand-textActive truncate">{s.name}</div>
                          <div className="text-[10px] uppercase tracking-wider text-brand-textMuted">{m.label}</div>
                        </div>
                        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${s.visited ? 'bg-brand-success/15 text-brand-success' : 'bg-brand-textMuted/10 text-brand-textMuted'}`}>
                          {s.visited ? 'visited' : 'to visit'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Polling stations */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand-skyBlue uppercase tracking-wide">Polling stations</h2>
        {data.stations.length === 0 ? (
          <p className="text-sm text-brand-textMuted italic">No polling station name matches this village. <Link href={`/wards/${wardId}?tab=stations`} className="text-brand-aqua hover:underline not-italic">See all ward stations →</Link></p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {data.stations.map((s) => (
              <Link key={s.id} href={`/polling-stations/${s.id}`}
                className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-cardBg px-3 py-2 hover:border-brand-skyBlue/60 transition">
                <span className="text-base">🗳️</span>
                <span className="text-sm font-semibold text-brand-textActive truncate">{s.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Community leaders */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand-burnt uppercase tracking-wide">Community leaders &amp; elders</h2>
        {data.leaders.length === 0 ? (
          <p className="text-sm text-brand-textMuted italic">No community leaders recorded for this village yet.</p>
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

      {/* Issues */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand-rust uppercase tracking-wide">Issues &amp; problems</h2>
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
