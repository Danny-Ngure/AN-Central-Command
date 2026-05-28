import { people, wards } from '@an/db';
import { eq, isNull, and, sql } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Aspirant',
  campaign_manager: 'Campaign Manager',
  chief_strategist: 'Chief Strategist',
  constituency_coordinator: 'Constituency Coordinator',
  ward_coordinator: 'Ward Coordinator',
  assistant_ward_coordinator: 'Asst. Ward Coordinator',
  polling_station_lead: 'Polling Station Lead',
  polling_agent: 'Polling Agent',
  canvasser: 'Canvasser',
  influence_liaison: 'Influence Liaison',
  media_head: 'Media Head',
  comms_head: 'Comms Head',
  patron_ceo: 'Patron / CEO',
  tech_lead: 'Tech Lead',
  finance_lead: 'Finance Lead',
};

// Role display order (executive first, then operational, then ward field roles).
const ROLE_ORDER = [
  'candidate', 'campaign_manager', 'chief_strategist', 'constituency_coordinator',
  'patron_ceo', 'tech_lead', 'media_head', 'comms_head', 'finance_lead',
  'ward_coordinator', 'assistant_ward_coordinator',
  'polling_station_lead', 'polling_agent',
  'influence_liaison', 'canvasser',
];

export default async function TeamPage() {
  const claims = await getServerAuthOrRedirect();

  const data = await withRlsTx(claims, async (tx) => {
    const peopleRows = await tx
      .select({
        id: people.id,
        fullName: people.fullName,
        role: people.role,
        wardId: people.wardId,
        phone: people.phone,
        email: people.email,
        lastActiveAt: people.lastActiveAt,
      })
      .from(people)
      .where(and(eq(people.active, true), isNull(people.deletedAt)))
      .orderBy(people.fullName);

    const wardRows = await tx.select({ id: wards.id, name: wards.name }).from(wards);
    const wardName = new Map(wardRows.map((w) => [w.id, w.name]));

    // Group by role.
    const grouped = new Map<string, typeof peopleRows>();
    for (const p of peopleRows) {
      const list = grouped.get(p.role) ?? [];
      list.push(p);
      grouped.set(p.role, list);
    }

    return { grouped, wardName, total: peopleRows.length };
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Team Directory</h1>
        <p className="text-sm text-brand-textMuted">
          {data.total} active member{data.total === 1 ? '' : 's'} in your scope.
          RLS-filtered: leadership and oversight see everyone; ward-scoped roles see
          their ward plus leadership.
        </p>
      </header>

      {data.total === 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-cardBg p-6 text-sm text-brand-textMuted">
          No team members visible at your access level.
        </div>
      )}

      {ROLE_ORDER.map((role) => {
        const list = data.grouped.get(role);
        if (!list || list.length === 0) return null;
        return (
          <section key={role} className="space-y-2">
            <h2 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
              {ROLE_LABEL[role] ?? role} ({list.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {list.map((p) => {
                const isActive7d = p.lastActiveAt && new Date(p.lastActiveAt).getTime() > sevenDaysAgo;
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-brand-border bg-brand-cardBg p-3 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-violet/20 border border-brand-violet/30 flex items-center justify-center text-sm font-bold text-brand-violet">
                      {p.fullName.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-brand-textActive truncate">
                        {p.fullName}
                      </div>
                      <div className="text-xs text-brand-textMuted truncate">
                        {p.wardId ? data.wardName.get(p.wardId) : 'Constituency-wide'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive7d ? 'bg-emerald-500' : 'bg-brand-textMuted/40'}`} />
                      <span className="text-[10px] uppercase tracking-wider text-brand-textMuted">
                        {isActive7d ? 'Active' : 'Idle'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
