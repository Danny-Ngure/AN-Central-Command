import { db, people, wards } from '@an/db';
import { eq, isNull, and } from 'drizzle-orm';
import Link from 'next/link';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { PhoneActions } from '@/components/phone-actions';

// Team Directory — ANHF public-portal style (large circular photo, name + role
// stacked and centred). Three groups, switchable from the top-nav "Team" menu
// via ?group=:
//   • executive — strategy / operations / media / tech (the leadership team)
//   • wards     — grassroots ward coordination, grouped per ward
//   • warembo   — Warembo wa Alfayo (women's mobilisation wing)
// No ?group= shows all three.

// Identity-stable lookups keyed by fullName so phone changes don't break them.
const SUPER_USER_NAMES = new Set([
  'Alfayo Nelson',
  'Benson Imoli',
  'Dan Ngure',
]);

// Warembo wa Alfayo (women's wing) membership. Add member full names here, or set
// a person's `title` to include "Warembo" and they'll be picked up automatically.
const WAREMBO_NAMES = new Set<string>([
  'Diana Hildah Ogoye',
  'Caroline Ruwa',
  'Irene Mkamburi',
  'Rehema Sirleem',
  'Damah Sammy Baya',
  'Baby Omar',
  'Sofia Bakari',
]);

// Display order within the Warembo docket — chairlady first, then office bearers.
const WAREMBO_ORDER = [
  'Caroline Ruwa',
  'Diana Hildah Ogoye',
  'Irene Mkamburi',
  'Rehema Sirleem',
  'Damah Sammy Baya',
  'Baby Omar',
  'Sofia Bakari',
];

// Docket-specific titles within Warembo wa Alfayo. These override a person's
// global `title` only inside the Warembo section (some hold a different post in
// the Executive docket — e.g. Irene is "Head of Planning & Activities" there).
const WAREMBO_TITLES: Record<string, string> = {
  'Caroline Ruwa': 'Chairlady',
  'Diana Hildah Ogoye': 'Organizing Secretary',
  'Irene Mkamburi': 'Head of Media',
};

const OPERATIONAL_BASE: Record<string, string> = {
  'Alfayo Nelson':  'Campaign HQ (Nyali)',
  'Benson Imoli':   'Campaign HQ (Nyali)',
  'Dan Ngure':      'Campaign HQ / Media Hub',
  'Justine Katana': 'Constituency-Wide',
  'Cavins Omino':   'Constituency-Wide',
  'Arnold Baya':    'Campaign HQ / Field',
  'Irene Mkamburi': 'Constituency-Wide',
  'Javas Tindi':    'Media Hub',
  'Ryan Siriba':    'Media Hub',
};

// Dual-role: Arnold also appears as Asst Ward Rep for Kadzandani.
const DUAL_WARD_ASSIGNMENTS: Record<string, string> = {
  'Arnold Baya': '22222222-0000-4000-8000-000000000001',
};

// Order within Executive Team — top-down hierarchy.
const EXEC_ROLE_ORDER = [
  'candidate', 'chief_strategist', 'patron_ceo',
  'constituency_coordinator',
  'campaign_manager',
  'tech_lead', 'comms_head', 'media_head',
  'finance_lead', 'influence_liaison',
];

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Aspirant',
  campaign_manager: 'Campaign Manager',
  chief_strategist: 'Chief Strategist',
  constituency_coordinator: 'Constituency Coordinator',
  ward_coordinator: 'Ward Representative',
  assistant_ward_coordinator: 'Assistant Ward Representative',
  polling_station_lead: 'Polling Station Lead',
  polling_agent: 'Polling Agent',
  canvasser: 'Canvasser',
  influence_liaison: 'Influence Liaison',
  media_head: 'Media Team',
  comms_head: 'Comms Head',
  patron_ceo: 'Patron / CEO',
  tech_lead: 'Tech Lead',
  finance_lead: 'Finance Lead',
};

type Group = 'executive' | 'wards' | 'warembo' | 'all';

export default async function TeamPage({ searchParams }: { searchParams: { group?: string } }) {
  await getServerAuthOrRedirect();
  const group: Group = (['executive', 'wards', 'warembo'].includes(searchParams.group ?? '')
    ? searchParams.group
    : 'all') as Group;

  // The team directory is org info every signed-in member should see, so it is
  // read directly (not RLS-scoped) — otherwise limited roles (e.g. comms_head)
  // would only see themselves.
  const data = await (async () => {
    const peopleRows = await db
      .select({
        id: people.id,
        fullName: people.fullName,
        role: people.role,
        title: people.title,
        wardId: people.wardId,
        phone: people.phone,
        email: people.email,
        photoUrl: people.photoUrl,
        lastActiveAt: people.lastActiveAt,
        teamId: people.teamId,
      })
      .from(people)
      .where(and(eq(people.active, true), isNull(people.deletedAt)))
      .orderBy(people.fullName);

    const wardRows = await db.select({ id: wards.id, name: wards.name }).from(wards).orderBy(wards.name);
    const wardName = new Map(wardRows.map((w) => [w.id, w.name]));
    return { peopleRows, wardName, wardOrder: wardRows.map((w) => w.id) };
  })();

  const isWardRole = (role: string) =>
    role === 'ward_coordinator' || role === 'assistant_ward_coordinator';
  const isWarembo = (p: PersonRow) =>
    WAREMBO_NAMES.has(p.fullName) || (p.title ?? '').toLowerCase().includes('warembo');

  // ── Executive + Technical Team (two sub-groups) ────────────────────────
  const TECH_ROLES = new Set(['tech_lead', 'media_head', 'comms_head']);
  // People who should appear in the Executive Team regardless of their role/group
  // (e.g. they also sit on the Warembo docket but lead at the executive level).
  const FORCE_EXECUTIVE = new Set(['Irene Mkamburi']);
  const execSort = (a: PersonRow, b: PersonRow) => {
    const ai = EXEC_ROLE_ORDER.indexOf(a.role);
    const bi = EXEC_ROLE_ORDER.indexOf(b.role);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.fullName.localeCompare(b.fullName);
  };
  const executive = data.peopleRows
    .filter((p) => !isWardRole(p.role) && (FORCE_EXECUTIVE.has(p.fullName) || (!isWarembo(p) && !TECH_ROLES.has(p.role))))
    .sort(execSort);
  const technical = data.peopleRows
    .filter((p) => !isWardRole(p.role) && !isWarembo(p) && TECH_ROLES.has(p.role) && !FORCE_EXECUTIVE.has(p.fullName))
    .sort(execSort);

  // ── Warembo wa Alfayo ──────────────────────────────────────────────────
  const warembo = data.peopleRows.filter(isWarembo).sort((a, b) => {
    const ai = WAREMBO_ORDER.indexOf(a.fullName);
    const bi = WAREMBO_ORDER.indexOf(b.fullName);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // ── Grassroots & Ward Coordination Team ────────────────────────────────
  // Every active member with a home ward appears under that ward — ward
  // coordinators & assistants are the leadership; executives and Warembo members
  // are listed below them as part of that ward's team (dual-listed; they also
  // appear in their Executive/Warembo docket above).
  const wardRank = (p: PersonRow) =>
    p.role === 'ward_coordinator' ? 0 : p.role === 'assistant_ward_coordinator' ? 1 : 2;
  const byWard = new Map<string, typeof data.peopleRows>();
  const pushWard = (wId: string, p: PersonRow) => {
    (byWard.get(wId) ?? byWard.set(wId, []).get(wId)!).push(p);
  };
  for (const p of data.peopleRows) {
    if (p.wardId) pushWard(p.wardId, p);
  }
  // Legacy explicit dual assignments (person whose home ward differs from where
  // they should also be shown — e.g. Arnold).
  for (const [name, wId] of Object.entries(DUAL_WARD_ASSIGNMENTS)) {
    const exec = data.peopleRows.find((p) => p.fullName === name);
    if (!exec || exec.wardId === wId) continue;
    pushWard(wId, exec);
  }
  for (const list of byWard.values()) {
    list.sort((a, b) => wardRank(a) - wardRank(b) || a.fullName.localeCompare(b.fullName));
  }
  const totalWardTeamCount = Array.from(byWard.values()).reduce((s, l) => s + l.length, 0);

  const showExec = group === 'all' || group === 'executive';
  const showWards = group === 'all' || group === 'wards';
  const showWarembo = group === 'all' || group === 'warembo';

  const TABS: { key: Group; label: string; href: string }[] = [
    { key: 'all', label: 'Everyone', href: '/team' },
    { key: 'executive', label: 'Executive', href: '/team?group=executive' },
    { key: 'wards', label: 'All Wards', href: '/team?group=wards' },
    { key: 'warembo', label: 'Warembo', href: '/team?group=warembo' },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-brand-textActive">Team Directory</h1>
        <p className="text-sm text-brand-textMuted">
          Alfayo Nelson Hope Foundation campaign organisation. {data.peopleRows.length} active members.
          <span className="text-brand-burnt"> ★</span> marks the three Super Admins (Alfayo Nelson ·
          Benson Imoli · Dan Ngure).
        </p>
        {/* Group filter chips (mirror the nav dropdown). */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tabItem) => (
            <Link
              key={tabItem.key}
              href={tabItem.href}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-semibold transition border',
                group === tabItem.key
                  ? 'bg-brand-burnt text-white border-brand-burnt'
                  : 'border-brand-border text-brand-textMuted hover:text-brand-textActive hover:border-brand-borderStrong',
              ].join(' ')}
            >
              {tabItem.label}
            </Link>
          ))}
        </div>
      </header>

      {/* 🛠 EXECUTIVE TEAM */}
      {showExec && executive.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Executive Team" count={`${executive.length} members`} />
          <CardGrid>
            {executive.map((p) => (
              <PersonCard
                key={p.id}
                p={p}
                wardName={null}
                isSuperUser={SUPER_USER_NAMES.has(p.fullName)}
                operationalBase={OPERATIONAL_BASE[p.fullName]}
                dualRole={p.fullName in DUAL_WARD_ASSIGNMENTS}
              />
            ))}
          </CardGrid>
        </section>
      )}

      {/* 💻 TECHNICAL TEAM */}
      {showExec && technical.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Technical Team" count={`${technical.length} members`} />
          <CardGrid>
            {technical.map((p) => (
              <PersonCard
                key={p.id}
                p={p}
                wardName={null}
                isSuperUser={SUPER_USER_NAMES.has(p.fullName)}
                operationalBase={OPERATIONAL_BASE[p.fullName]}
                dualRole={p.fullName in DUAL_WARD_ASSIGNMENTS}
              />
            ))}
          </CardGrid>
        </section>
      )}

      {/* 📍 GRASSROOTS & WARD COORDINATION TEAM */}
      {showWards && (
        <section className="space-y-4">
          <SectionHeader title="Grassroots & Ward Coordination" count={`${totalWardTeamCount} field roles`} />
          {data.wardOrder.map((wId) => {
            const members = byWard.get(wId) ?? [];
            if (members.length === 0) return null;
            const wName = data.wardName.get(wId) ?? '—';
            const inCharge = members.find((m) => m.role === 'ward_coordinator');
            const wardAssistants = members.filter((m) => m.role === 'assistant_ward_coordinator');
            // Execs / Warembo / other members whose home ward is this one.
            const otherMembers = members.filter((m) => !isWardRole(m.role));
            return (
              <div key={wId} className="rounded-2xl border border-brand-border bg-brand-cardBg/50 p-4 space-y-4">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-brand-textActive">{wName} Ward</h3>
                  {inCharge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-burnt">
                      Person in Charge: {inCharge.fullName}
                    </span>
                  )}
                </div>
                {/* Leadership — always shown */}
                <CardGrid>
                  {inCharge && (
                    <PersonCard
                      p={inCharge}
                      wardName={wName}
                      isSuperUser={SUPER_USER_NAMES.has(inCharge.fullName)}
                      operationalBase={null}
                      highlight
                      forceLabel="Ward Representative"
                    />
                  )}
                  {wardAssistants.map((a) => (
                    <PersonCard
                      key={a.id + ':' + wId}
                      p={a}
                      wardName={wName}
                      isSuperUser={SUPER_USER_NAMES.has(a.fullName)}
                      operationalBase={null}
                      forceLabel="Assistant Ward Representative"
                    />
                  ))}
                </CardGrid>

                {/* Other ward members — collapsed behind a button */}
                {otherMembers.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-cardBg px-4 py-1.5 text-xs font-bold text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt transition select-none">
                      <span className="group-open:hidden">▸ See other members ({otherMembers.length})</span>
                      <span className="hidden group-open:inline">▾ Hide other members</span>
                    </summary>
                    <div className="mt-3">
                      <CardGrid>
                        {otherMembers.map((a) => (
                          <PersonCard
                            key={a.id + ':' + wId}
                            p={a}
                            wardName={wName}
                            isSuperUser={SUPER_USER_NAMES.has(a.fullName)}
                            operationalBase={null}
                            dualRole
                          />
                        ))}
                      </CardGrid>
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* 👩🏽‍🤝‍👩🏽 WAREMBO WA ALFAYO */}
      {showWarembo && (
        <section className="space-y-4">
          <SectionHeader title="Warembo wa Alfayo" count={`${warembo.length} members`} />
          {warembo.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-borderStrong bg-brand-cardBg/40 p-8 text-center">
              <div className="text-3xl mb-2">🌸</div>
              <div className="text-sm font-semibold text-brand-textActive">No Warembo members added yet</div>
              <p className="text-xs text-brand-textMuted mt-1 max-w-md mx-auto">
                The Warembo wa Alfayo women&apos;s wing will appear here. Add members by setting their job
                title to include &ldquo;Warembo&rdquo;, or share the names and I&apos;ll list them.
              </p>
            </div>
          ) : (
            <CardGrid>
              {warembo.map((p) => (
                <PersonCard
                  key={p.id}
                  p={p}
                  wardName={p.wardId ? data.wardName.get(p.wardId) ?? null : null}
                  isSuperUser={SUPER_USER_NAMES.has(p.fullName)}
                  operationalBase={OPERATIONAL_BASE[p.fullName]}
                  titleOverride={WAREMBO_TITLES[p.fullName]}
                />
              ))}
            </CardGrid>
          )}
        </section>
      )}
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-brand-border pb-2">
      <h2 className="text-base font-bold text-brand-textActive">{title}</h2>
      <span className="text-xs text-brand-textMuted">{count}</span>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

// Palette tones for person cards — picked per name so each reads distinctly.
// Full class strings so Tailwind JIT generates them.
const PERSON_TONES = [
  { bar: 'bg-brand-burnt', tint: 'bg-brand-burnt/[0.05]' },
  { bar: 'bg-brand-teal',  tint: 'bg-brand-teal/[0.05]' },
  { bar: 'bg-brand-rust',  tint: 'bg-brand-rust/[0.05]' },
  { bar: 'bg-brand-brown', tint: 'bg-brand-brown/[0.05]' },
  { bar: 'bg-brand-olive', tint: 'bg-brand-olive/[0.05]' },
  { bar: 'bg-brand-gold',  tint: 'bg-brand-gold/[0.06]' },
];
function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % PERSON_TONES.length;
  return PERSON_TONES[h];
}

interface PersonRow {
  id: string;
  fullName: string;
  role: string;
  title: string | null;
  wardId: string | null;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  lastActiveAt: Date | null;
  teamId: string | null;
}

// Portal-style card: big circular photo, name + role centred beneath.
function PersonCard({
  p,
  wardName,
  isSuperUser,
  operationalBase,
  highlight,
  forceLabel,
  titleOverride,
  dualRole,
}: {
  p: PersonRow;
  wardName: string | null;
  isSuperUser: boolean;
  operationalBase?: string | null;
  highlight?: boolean;
  forceLabel?: string;
  // Docket-specific title that wins over p.title — used so someone who holds
  // different posts in two dockets (e.g. Irene: Exec "Head of Planning" but
  // Warembo "Head of Media") shows the right title per section.
  titleOverride?: string;
  dualRole?: boolean;
}) {
  const initials = p.fullName.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const roleLabel = titleOverride ?? p.title ?? forceLabel ?? ROLE_LABEL[p.role] ?? p.role;
  const ver = p.lastActiveAt ? new Date(p.lastActiveAt).getTime() : 0;
  const photoSrc = p.photoUrl ? `${p.photoUrl}?v=${ver}` : null;
  const tone = toneFor(p.fullName);

  return (
    <div
      className={[
        'relative overflow-hidden rounded-2xl border p-5 pt-6 flex flex-col items-center text-center transition shadow-sm hover:shadow-md hover:border-brand-borderStrong',
        tone.tint,
        highlight ? 'border-brand-burnt/50' : 'border-brand-border',
      ].join(' ')}
    >
      {/* Colour accent bar */}
      <div className={`absolute inset-x-0 top-0 h-1.5 ${tone.bar}`} />
      {/* Circular photo / initials */}
      <div className="relative">
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt={p.fullName}
            className="w-24 h-24 rounded-full object-cover border-2 border-brand-brown/50"
          />
        ) : (
          <div
            className={[
              'w-24 h-24 rounded-full border-2 flex items-center justify-center text-2xl font-bold',
              isSuperUser
                ? 'bg-brand-burnt/15 border-brand-burnt/50 text-brand-burnt'
                : 'bg-brand-teal/10 border-brand-teal/40 text-brand-teal',
            ].join(' ')}
          >
            {initials}
          </div>
        )}
        {isSuperUser && (
          <span
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-gold text-black text-sm font-bold flex items-center justify-center border-2 border-brand-cardBg"
            title="Super Admin"
          >
            ★
          </span>
        )}
      </div>

      {/* Name (links to the person's 360 profile) */}
      <Link
        href={`/team/${p.id}`}
        className="mt-3 text-lg font-bold text-brand-textActive leading-tight hover:text-brand-burnt hover:underline"
      >
        {p.fullName}
      </Link>

      {/* Role / title (prominent, like the portal) */}
      <div className="mt-0.5 text-sm font-semibold text-brand-burnt">{roleLabel}</div>

      {/* Secondary context */}
      <div className="mt-0.5 text-[11px] text-brand-textMuted">
        {wardName ? wardName : operationalBase ? operationalBase : ROLE_LABEL[p.role] ?? p.role}
      </div>

      {/* Team ID badge — clickable to the ID card */}
      {p.teamId && (
        <Link
          href={`/team/${p.id}`}
          className="mt-1 inline-block rounded-md bg-brand-burnt/15 border border-brand-burnt/30 px-2 py-0.5 text-[10px] font-black tracking-widest text-brand-burnt hover:bg-brand-burnt hover:text-white transition"
          title="View ID card"
        >
          {p.teamId}
        </Link>
      )}

      {/* Badges */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        {isSuperUser ? (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-brand-burnt/20 text-brand-burnt border border-brand-burnt/40">
            ★ Super Admin
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-brand-olive/20 text-brand-olive border border-brand-olive/40">
            Peer
          </span>
        )}
        {dualRole && (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-brand-teal/20 text-brand-teal border border-brand-teal/40" title="Holds two roles">
            Dual role
          </span>
        )}
      </div>

      {/* Phone + actions */}
      <div className="mt-3 flex flex-col items-center gap-2">
        <span className="text-[11px] text-brand-textMuted font-mono">{p.phone}</span>
        <PhoneActions phone={p.phone} size="sm" />
        <Link
          href={`/team/${p.id}`}
          className="text-[10px] font-bold uppercase tracking-wider text-brand-aqua hover:text-brand-skyBlue"
        >
          View 360 profile →
        </Link>
      </div>

      {/* Inline photo upload (collapsed) */}
      <details className="text-xs w-full mt-3">
        <summary className="cursor-pointer text-brand-textMuted hover:text-brand-burnt select-none list-none flex items-center justify-center gap-1 border-t border-brand-border/40 pt-2">
          <span className="text-[10px]">▾</span>
          <span>{p.photoUrl ? '📷 Change photo' : '📷 Upload photo'}</span>
        </summary>
        <form
          action={`/api/team/${p.id}/photo`}
          method="post"
          encType="multipart/form-data"
          className="mt-2 space-y-2 bg-black/20 rounded-lg p-2 text-left"
        >
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-[11px] text-brand-textActive file:mr-2 file:rounded file:border-0 file:bg-brand-burnt file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-white hover:file:bg-brand-rust"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-brand-textMuted">JPG · PNG · WebP · max 5 MiB</span>
            <button
              type="submit"
              className="rounded-md bg-brand-burnt px-3 py-1 text-[10px] font-semibold text-white hover:bg-brand-rust"
            >
              Save photo
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
