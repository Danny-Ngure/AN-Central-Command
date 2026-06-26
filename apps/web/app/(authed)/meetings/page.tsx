import Link from 'next/link';
import { and, asc, eq, gte, isNull, isNotNull, lt, or, sql, inArray, ilike, desc } from 'drizzle-orm';
import {
  activities,
  communitySites,
  meetings,
  people,
  wards,
} from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { PhoneActions } from '@/components/phone-actions';

// /meetings — the central scheduling hub.
//
// One server-rendered page with three job-to-be-done modes selected via URL:
//
//   1. Default — list view (today / week / month tabs)
//   2. ?action=new           — schedule a meeting form (search contacts + time + place)
//   3. ?action=new-activity  — schedule an activity AT a community site
//   4. ?view=unvisited       — search/filter community sites that have not been visited
//
// All forms are plain HTML <form method="post"> so the page works without JS.
// WhatsApp is a deeplink (wa.me/+254XXXX?text=…) — no API call.

// ── URL parsing ─────────────────────────────────────────────────────────────

type RangeKey = 'today' | 'week' | 'month';
const VALID_RANGES: RangeKey[] = ['today', 'week', 'month'];

const MEETING_TYPES = [
  { value: 'internal_strategy',  label: 'Internal strategy' },
  { value: 'community_baraza',   label: 'Community baraza' },
  { value: 'stakeholder',        label: 'Stakeholder meeting' },
  { value: 'condolence_visit',   label: 'Condolence visit' },
  { value: 'harambee',           label: 'Harambee' },
  { value: 'courtesy_call',      label: 'Courtesy call' },
  { value: 'media',              label: 'Media engagement' },
];

const ACTIVITY_TYPES = [
  { value: 'rally',               label: 'Rally' },
  { value: 'baraza',              label: 'Baraza' },
  { value: 'community_meeting',   label: 'Community meeting' },
  { value: 'town_hall',           label: 'Town hall' },
  { value: 'mosque_visit',        label: 'Mosque visit' },
  { value: 'church_visit',        label: 'Church visit' },
  { value: 'madrasa_visit',       label: 'Madrasa visit' },
  { value: 'boda_stage_stop',     label: 'Boda stage stop' },
  { value: 'market_visit',        label: 'Market visit' },
  { value: 'chama_meeting',       label: 'Chama meeting' },
  { value: 'door_to_door',        label: 'Door-to-door' },
  { value: 'youth_event',         label: 'Youth event' },
  { value: 'women_event',         label: 'Women event' },
  { value: 'harambee',            label: 'Harambee' },
  { value: 'condolence_visit',    label: 'Condolence visit' },
  { value: 'wedding_attendance',  label: 'Wedding attendance' },
  { value: 'courtesy_call',       label: 'Courtesy call' },
  { value: 'media_engagement',    label: 'Media engagement' },
  { value: 'launch_event',        label: 'Launch event' },
  { value: 'internal_strategy',   label: 'Internal strategy' },
  { value: 'training',            label: 'Training' },
  { value: 'other',               label: 'Other' },
];

const SITE_CATEGORIES = [
  { key: 'all',      label: 'All',      types: null as string[] | null },
  { key: 'mosques',  label: 'Mosques',  types: ['mosque', 'madrasa'] },
  { key: 'churches', label: 'Churches', types: ['church'] },
  { key: 'social',   label: 'Social halls', types: ['social_hall', 'community_hall', 'youth_center', 'sports_club'] },
  { key: 'boda',     label: 'Boda',     types: ['boda_stage'] },
  { key: 'other',    label: 'Other',    types: ['matatu_stage', 'market', 'shopping_center', 'school_primary', 'school_secondary', 'school_other', 'chama', 'sacco', 'self_help_group', 'health_facility', 'government_office', 'other'] },
];

const MEETING_TYPE_LABEL: Record<string, string> = MEETING_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }), {},
);

// Short, human labels + an emoji for site types shown in the itinerary builder.
const SITE_TYPE_META: Record<string, { label: string; icon: string }> = {
  mosque:           { label: 'Mosque',          icon: '🕌' },
  madrasa:          { label: 'Madrasa',         icon: '📖' },
  church:           { label: 'Church',          icon: '⛪' },
  social_hall:      { label: 'Social hall',     icon: '🏛️' },
  community_hall:   { label: 'Community hall',  icon: '🏛️' },
  youth_center:     { label: 'Youth centre',    icon: '🧑‍🤝‍🧑' },
  sports_club:      { label: 'Sports club',     icon: '⚽' },
  boda_stage:       { label: 'Boda stage',      icon: '🏍️' },
  matatu_stage:     { label: 'Matatu stage',    icon: '🚐' },
  market:           { label: 'Market',          icon: '🛒' },
  shopping_center:  { label: 'Shopping centre', icon: '🏬' },
  school_public:    { label: 'Public school',   icon: '🏫' },
  school_private:   { label: 'Private school',  icon: '🏫' },
  school_secondary: { label: 'Secondary school',icon: '🏫' },
  school_primary:   { label: 'Primary school',  icon: '🏫' },
  school_tertiary:  { label: 'College',         icon: '🎓' },
  school_other:     { label: 'School',          icon: '🏫' },
  welfare_group:    { label: 'Welfare group',   icon: '🤝' },
  chama:            { label: 'Chama',           icon: '💰' },
  sacco:            { label: 'SACCO',           icon: '💳' },
  self_help_group:  { label: 'Self-help group', icon: '🤝' },
  health_facility:  { label: 'Health facility', icon: '🏥' },
  government_office:{ label: 'Govt office',     icon: '🏢' },
  other:            { label: 'Other',           icon: '📍' },
};
function typeMeta(type: string) {
  return SITE_TYPE_META[type] ?? { label: type.replace(/_/g, ' '), icon: '📍' };
}
// Local YYYY-MM-DD for <input type=date> defaults/min (avoids UTC off-by-one).
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface PageProps {
  searchParams: {
    action?: string;
    view?: string;
    range?: string;
    q?: string;
    category?: string;
    ward?: string;
    contactQ?: string;
    siteQ?: string;
    created?: string;
    activityCreated?: string;
    meetingError?: string;
    activityError?: string;
    open?: string;        // ward id to auto-expand in the itinerary builder
    planError?: string;
  };
}

export default async function MeetingsPage({ searchParams }: PageProps) {
  const claims = await getServerAuthOrRedirect();
  const action = searchParams.action ?? '';
  const view   = searchParams.view ?? '';
  const range: RangeKey = (VALID_RANGES.includes(searchParams.range as RangeKey)
    ? searchParams.range
    : 'week') as RangeKey;
  const search = (searchParams.q ?? '').trim();
  const category = searchParams.category ?? 'all';
  const wardFilter = searchParams.ward ?? '';
  const contactQ = (searchParams.contactQ ?? '').trim();
  const siteQ = (searchParams.siteQ ?? '').trim();

  // Date ranges. Use simple JS Date arithmetic — DB uses inclusive >= and exclusive <.
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
  const dayEnd   = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const weekEnd  = new Date(dayStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthEnd = new Date(dayStart); monthEnd.setMonth(monthEnd.getMonth() + 1);

  const rangeStart = dayStart;
  const rangeEnd = range === 'today' ? dayEnd : range === 'week' ? weekEnd : monthEnd;

  const data = await withRlsTx(claims, async (tx) => {
    // Wards for ward filter dropdown.
    const wardRows = await tx
      .select({ id: wards.id, name: wards.name })
      .from(wards)
      .orderBy(asc(wards.name));

    // Meetings in range.
    const meetingFilters = [
      gte(meetings.scheduledAt, rangeStart),
      lt(meetings.scheduledAt, rangeEnd),
      isNull(meetings.deletedAt),
    ];
    if (search) {
      meetingFilters.push(
        or(
          ilike(meetings.title, `%${search}%`),
          ilike(meetings.location, `%${search}%`),
        )!,
      );
    }
    const meetingRows = await tx
      .select({
        id: meetings.id,
        title: meetings.title,
        type: meetings.type,
        scheduledAt: meetings.scheduledAt,
        location: meetings.location,
        agenda: meetings.agenda,
        status: meetings.status,
        inviteePersonIds: meetings.inviteePersonIds,
        ownerPersonId: meetings.ownerPersonId,
      })
      .from(meetings)
      .where(and(...meetingFilters))
      .orderBy(asc(meetings.scheduledAt));

    // Activities at sites in range.
    const activityRows = await tx
      .select({
        id: activities.id,
        title: activities.title,
        type: activities.type,
        scheduledAt: activities.scheduledAt,
        locationName: activities.locationName,
        wardId: activities.wardId,
        status: activities.status,
      })
      .from(activities)
      .where(and(
        gte(activities.scheduledAt, rangeStart),
        lt(activities.scheduledAt, rangeEnd),
        isNull(activities.deletedAt),
      ))
      .orderBy(asc(activities.scheduledAt));

    // Resolve all invitee + owner person rows in one go.
    const allPeopleIds = new Set<string>();
    meetingRows.forEach((m) => {
      allPeopleIds.add(m.ownerPersonId);
      (m.inviteePersonIds ?? []).forEach((id) => allPeopleIds.add(id));
    });
    let peopleMap = new Map<string, { id: string; fullName: string; phone: string; role: string }>();
    if (allPeopleIds.size > 0) {
      const rows = await tx
        .select({ id: people.id, fullName: people.fullName, phone: people.phone, role: people.role })
        .from(people)
        .where(inArray(people.id, Array.from(allPeopleIds)));
      peopleMap = new Map(rows.map((r) => [r.id, r]));
    }

    // Contact search (for the new-meeting form).
    let contactRows: { id: string; fullName: string; phone: string; role: string; wardId: string | null }[] = [];
    if (action === 'new') {
      const filters = [
        eq(people.active, true),
        isNull(people.deletedAt),
      ];
      if (contactQ) {
        filters.push(or(
          ilike(people.fullName, `%${contactQ}%`),
          ilike(people.phone, `%${contactQ}%`),
        )!);
      }
      contactRows = await tx
        .select({
          id: people.id,
          fullName: people.fullName,
          phone: people.phone,
          role: people.role,
          wardId: people.wardId,
        })
        .from(people)
        .where(and(...filters))
        .orderBy(asc(people.fullName))
        .limit(30);
    }

    // Unvisited sites (for /meetings?view=unvisited or new-activity).
    let unvisitedSites: { id: string; name: string; type: string; areaName: string | null; wardId: string; wardName: string | null }[] = [];
    let unvisitedTotal = 0;
    if (view === 'unvisited' || action === 'new-activity') {
      const cat = SITE_CATEGORIES.find((c) => c.key === category) ?? SITE_CATEGORIES[0]!;
      const filters = [
        isNull(communitySites.deletedAt),
        eq(communitySites.visited, false),
      ];
      if (cat.types) filters.push(inArray(communitySites.type, cat.types as any));
      if (wardFilter) filters.push(eq(communitySites.wardId, wardFilter));
      if (siteQ) {
        filters.push(or(
          ilike(communitySites.name, `%${siteQ}%`),
          ilike(communitySites.areaName, `%${siteQ}%`),
        )!);
      }
      unvisitedSites = await tx
        .select({
          id: communitySites.id,
          name: communitySites.name,
          type: communitySites.type,
          areaName: communitySites.areaName,
          wardId: communitySites.wardId,
          wardName: wards.name,
        })
        .from(communitySites)
        .leftJoin(wards, eq(wards.id, communitySites.wardId))
        .where(and(...filters))
        .orderBy(asc(wards.name), asc(communitySites.name))
        .limit(80);

      const [{ value }] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(communitySites)
        .where(and(...filters));
      unvisitedTotal = Number(value);
    }

    // ── Plan-my-month itinerary builder (action=plan) ──────────────────────
    // Greeting name + every unvisited site (clustered by ward → area on the
    // client) + everything already planned (the itinerary board).
    let firstName = 'there';
    let planUnvisited: { id: string; name: string; type: string; areaName: string | null; wardId: string; wardName: string | null; plannedVisitAt: Date | null }[] = [];
    let planItinerary: { id: string; name: string; type: string; areaName: string | null; wardId: string; wardName: string | null; plannedVisitAt: Date; plannedPurpose: string | null }[] = [];
    if (action === 'plan') {
      const me = await tx
        .select({ fullName: people.fullName })
        .from(people)
        .where(eq(people.id, claims.sub))
        .limit(1);
      if (me[0]?.fullName) firstName = me[0].fullName.split(' ')[0]!;

      planUnvisited = await tx
        .select({
          id: communitySites.id,
          name: communitySites.name,
          type: communitySites.type,
          areaName: communitySites.areaName,
          wardId: communitySites.wardId,
          wardName: wards.name,
          plannedVisitAt: communitySites.plannedVisitAt,
        })
        .from(communitySites)
        .leftJoin(wards, eq(wards.id, communitySites.wardId))
        .where(and(isNull(communitySites.deletedAt), eq(communitySites.visited, false)))
        .orderBy(asc(wards.name), asc(communitySites.areaName), asc(communitySites.name));

      const planned = await tx
        .select({
          id: communitySites.id,
          name: communitySites.name,
          type: communitySites.type,
          areaName: communitySites.areaName,
          wardId: communitySites.wardId,
          wardName: wards.name,
          plannedVisitAt: communitySites.plannedVisitAt,
          plannedPurpose: communitySites.plannedPurpose,
        })
        .from(communitySites)
        .leftJoin(wards, eq(wards.id, communitySites.wardId))
        .where(and(isNull(communitySites.deletedAt), isNotNull(communitySites.plannedVisitAt)))
        .orderBy(asc(communitySites.plannedVisitAt));
      planItinerary = planned.filter((p): p is typeof p & { plannedVisitAt: Date } => p.plannedVisitAt != null);
    }

    return { wardRows, meetingRows, activityRows, peopleMap, contactRows, unvisitedSites, unvisitedTotal, firstName, planUnvisited, planItinerary };
  });

  // Compose entries (meetings + activities merged into one sorted feed)
  type Entry =
    | { kind: 'meeting'; id: string; title: string; type: string; scheduledAt: Date; location: string | null; agenda: string | null; status: string; inviteeIds: string[]; ownerId: string }
    | { kind: 'activity'; id: string; title: string; type: string; scheduledAt: Date; locationName: string | null; wardId: string | null; status: string };

  const entries: Entry[] = [
    ...data.meetingRows.map((m): Entry => ({
      kind: 'meeting',
      id: m.id, title: m.title, type: m.type, scheduledAt: m.scheduledAt,
      location: m.location, agenda: m.agenda, status: m.status,
      inviteeIds: m.inviteePersonIds ?? [], ownerId: m.ownerPersonId,
    })),
    ...data.activityRows.map((a): Entry => ({
      kind: 'activity',
      id: a.id, title: a.title, type: a.type, scheduledAt: a.scheduledAt,
      locationName: a.locationName, wardId: a.wardId, status: a.status,
    })),
  ].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold text-brand-textActive">Meetings & activities</h1>
        <p className="text-sm text-brand-textBody">
          Schedule meetings, find unvisited sites, and message contacts on WhatsApp.
        </p>
      </header>

      {/* ── Success flashes ─────────────────────────────────────────── */}
      {searchParams.created && (
        <Flash tone="success">✓ Meeting scheduled. Invitees can be messaged below.</Flash>
      )}
      {searchParams.activityCreated && (
        <Flash tone="success">✓ Activity scheduled at the site.</Flash>
      )}
      {searchParams.meetingError && (
        <Flash tone="danger">{searchParams.meetingError}</Flash>
      )}
      {searchParams.activityError && (
        <Flash tone="danger">{searchParams.activityError}</Flash>
      )}
      {searchParams.planError && (
        <Flash tone="danger">{decodeURIComponent(searchParams.planError)}</Flash>
      )}

      {/* ── Mode tabs ───────────────────────────────────────────────── */}
      <nav className="flex flex-wrap gap-2">
        <ModeTab href="/meetings?action=plan" active={action === 'plan'} tone="orange">🗺️ Plan my month</ModeTab>
        <ModeTab href="/meetings" active={!action && !view}>📅 Calendar</ModeTab>
        <ModeTab href="/meetings?action=new" active={action === 'new'}>+ Schedule meeting</ModeTab>
        <ModeTab href="/meetings?action=new-activity" active={action === 'new-activity'}>+ Activity at site</ModeTab>
        <ModeTab href="/meetings?view=unvisited" active={view === 'unvisited'}>🎯 Unvisited sites</ModeTab>
      </nav>

      {/* ── Plan my month — the PA itinerary builder ────────────────────── */}
      {action === 'plan' && (
        <PlanMyMonth
          firstName={data.firstName}
          unvisited={data.planUnvisited}
          itinerary={data.planItinerary}
          openWard={searchParams.open ?? ''}
          now={now}
        />
      )}

      {/* ── Schedule meeting form ───────────────────────────────────── */}
      {action === 'new' && (
        <ScheduleMeetingForm contacts={data.contactRows} contactQ={contactQ} />
      )}

      {/* ── Activity at site form ───────────────────────────────────── */}
      {action === 'new-activity' && (
        <ActivityAtSiteForm
          sites={data.unvisitedSites}
          wardRows={data.wardRows}
          wardFilter={wardFilter}
          category={category}
          siteQ={siteQ}
          unvisitedTotal={data.unvisitedTotal}
        />
      )}

      {/* ── Unvisited sites finder ─────────────────────────────────── */}
      {view === 'unvisited' && (
        <UnvisitedSitesFinder
          sites={data.unvisitedSites}
          wardRows={data.wardRows}
          wardFilter={wardFilter}
          category={category}
          siteQ={siteQ}
          unvisitedTotal={data.unvisitedTotal}
        />
      )}

      {/* ── Calendar (default) ──────────────────────────────────────── */}
      {!action && !view && (
        <CalendarView
          entries={entries}
          range={range}
          search={search}
          peopleMap={data.peopleMap}
        />
      )}
    </div>
  );
}

// ── Calendar view ───────────────────────────────────────────────────────────

function CalendarView({
  entries, range, search, peopleMap,
}: {
  entries: any[]; range: RangeKey; search: string;
  peopleMap: Map<string, { id: string; fullName: string; phone: string; role: string }>;
}) {
  // Group entries by day
  const byDay = new Map<string, any[]>();
  entries.forEach((e) => {
    const dayKey = new Date(e.scheduledAt).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    (byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey))!.push(e);
  });
  const days = Array.from(byDay.entries());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1.5">
          {(['today', 'week', 'month'] as RangeKey[]).map((r) => (
            <Link
              key={r}
              href={`/meetings?range=${r}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
              className={[
                'px-3 py-1.5 rounded-md text-xs font-semibold transition',
                range === r
                  ? 'bg-brand-tealBlue text-white shadow-brand-teal'
                  : 'border border-brand-border text-brand-textMuted hover:text-brand-textActive',
              ].join(' ')}
            >
              {r === 'today' ? 'Today' : r === 'week' ? 'Next 7 days' : 'Next 30 days'}
            </Link>
          ))}
        </div>
        <form className="flex items-center gap-2" method="get">
          <input type="hidden" name="range" value={range} />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search title / location"
            className="bg-brand-cardBg border border-brand-border rounded-md px-3 py-1.5 text-xs text-brand-textActive placeholder:text-brand-textMuted focus:outline-none focus:border-brand-skyBlue w-60"
          />
          <button className="px-3 py-1.5 rounded-md bg-brand-tealBlue text-white text-xs font-semibold hover:bg-brand-tealBright">
            Search
          </button>
        </form>
      </div>

      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-brand-cardBg p-10 text-center">
          <p className="text-sm text-brand-textMuted">No meetings or activities in this range.</p>
          <Link href="/meetings?action=new" className="inline-block mt-3 text-xs font-bold text-brand-orangeBright hover:text-brand-orangePrimary">
            + Schedule something →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([day, dayEntries]) => (
            <div key={day} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-brand-skyBlue">{day}</h3>
                <span className="text-xs text-brand-textMuted">· {dayEntries.length}</span>
              </div>
              <ul className="space-y-2">
                {dayEntries.map((e) => (
                  <li key={`${e.kind}-${e.id}`}>
                    {e.kind === 'meeting'
                      ? <MeetingCard meeting={e} peopleMap={peopleMap} />
                      : <ActivityCard activity={e} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting: m, peopleMap }: { meeting: any; peopleMap: Map<string, any> }) {
  const invitees = (m.inviteeIds as string[]).map((id) => peopleMap.get(id)).filter(Boolean);
  const owner = peopleMap.get(m.ownerId);
  const time = new Date(m.scheduledAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div id={m.id} className="relative overflow-hidden rounded-xl border border-brand-border bg-brand-cardBg p-4">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-orangeBright" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-bold text-brand-textActive">{m.title}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-orangeBright">
              {MEETING_TYPE_LABEL[m.type] ?? m.type}
            </span>
          </div>
          <div className="text-xs text-brand-textMuted mt-0.5">
            🕐 {time}
            {m.location && <span> · 📍 {m.location}</span>}
            {owner && <span> · organized by {owner.fullName}</span>}
          </div>
          {m.agenda && (
            <p className="text-xs text-brand-textBody mt-2 whitespace-pre-line">{m.agenda}</p>
          )}
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-brand-textMuted">{m.status}</span>
      </div>

      {invitees.length > 0 && (
        <div className="mt-3 pt-3 border-t border-brand-border/60">
          <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-bold mb-2">
            Invitees ({invitees.length}) — message them on WhatsApp
          </div>
          <div className="flex flex-wrap gap-2">
            {invitees.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-brand-cardBgHeavy rounded-md px-2 py-1">
                <div className="text-xs">
                  <div className="font-semibold text-brand-textActive">{p.fullName}</div>
                  <div className="text-[10px] text-brand-textMuted">{p.role.replace(/_/g, ' ')}</div>
                </div>
                <PhoneActions
                  phone={p.phone}
                  size="sm"
                  defaultMessage={`Hi ${p.fullName.split(' ')[0]}, this is a reminder for "${m.title}" on ${new Date(m.scheduledAt).toLocaleString('en-KE')}${m.location ? ` at ${m.location}` : ''}. Thanks!`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity: a }: { activity: any }) {
  const time = new Date(a.scheduledAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="relative overflow-hidden rounded-xl border border-brand-border bg-brand-cardBg p-4">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-skyBlue" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-bold text-brand-textActive">{a.title}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-skyBlue">
              {a.type.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-xs text-brand-textMuted mt-0.5">
            🕐 {time}
            {a.locationName && <span> · 📍 {a.locationName}</span>}
            {a.wardId && <Link href={`/wards/${a.wardId}`} className="ml-1 text-brand-aqua hover:text-brand-skyBlue">[ward]</Link>}
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-brand-textMuted">{a.status}</span>
      </div>
    </div>
  );
}

// ── Schedule meeting form ───────────────────────────────────────────────────

function ScheduleMeetingForm({
  contacts, contactQ,
}: {
  contacts: { id: string; fullName: string; phone: string; role: string; wardId: string | null }[];
  contactQ: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Contact picker */}
      <div className="lg:col-span-1 rounded-xl border border-brand-border bg-brand-cardBg p-4 space-y-3">
        <div>
          <div className="text-sm font-bold text-brand-textActive">1. Pick contacts</div>
          <p className="text-[11px] text-brand-textMuted">Tick everyone to invite. The form on the right sends one invite per ticked person.</p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="action" value="new" />
          <input
            type="search"
            name="contactQ"
            defaultValue={contactQ}
            placeholder="Search name or phone"
            className="flex-1 bg-brand-cardBgHeavy border border-brand-border rounded-md px-2 py-1.5 text-xs text-brand-textActive placeholder:text-brand-textMuted focus:outline-none focus:border-brand-skyBlue"
          />
          <button className="px-2.5 py-1.5 rounded-md bg-brand-tealBlue text-white text-xs font-semibold">Find</button>
        </form>
        <p className="text-[10px] text-brand-textMuted">{contacts.length} matching contacts shown</p>
      </div>

      {/* Form */}
      <form
        method="post"
        action="/api/meetings/create"
        encType="multipart/form-data"
        className="lg:col-span-2 rounded-xl border border-brand-border bg-brand-cardBg p-4 space-y-4"
      >
        <div>
          <div className="text-sm font-bold text-brand-textActive">2. Meeting details</div>
          <p className="text-[11px] text-brand-textMuted">Required: title · date · time · type. WhatsApp messaging happens after.</p>
        </div>

        <FieldRow>
          <Field label="Title *" htmlFor="m-title">
            <input id="m-title" name="title" type="text" required maxLength={200}
              placeholder="e.g. Mosque elders courtesy call"
              className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
          </Field>
          <Field label="Type *" htmlFor="m-type">
            <select id="m-type" name="type" required
              className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue">
              {MEETING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Date & time *" htmlFor="m-scheduledAt">
            <input id="m-scheduledAt" name="scheduledAt" type="datetime-local" required
              className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
          </Field>
          <Field label="Location" htmlFor="m-location">
            <input id="m-location" name="location" type="text" maxLength={200}
              placeholder="Venue, hall, or address"
              className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
          </Field>
        </FieldRow>

        <Field label="Agenda" htmlFor="m-agenda">
          <textarea id="m-agenda" name="agenda" rows={3} maxLength={2000}
            placeholder="What will be discussed, who needs to speak, decisions needed"
            className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
        </Field>

        {/* Invitees picked from the contact list */}
        <fieldset className="space-y-2">
          <legend className="text-[11px] uppercase tracking-wider text-brand-textMuted font-bold">
            Invitees
          </legend>
          {contacts.length === 0 ? (
            <p className="text-xs text-brand-textMuted">No contacts. Try a different search on the left.</p>
          ) : (
            <div className="max-h-60 overflow-auto space-y-1 pr-1">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" name="invitees" value={c.id} className="accent-brand-orangeBright" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-brand-textActive truncate">{c.fullName}</div>
                    <div className="text-[10px] text-brand-textMuted truncate">{c.role.replace(/_/g, ' ')} · {c.phone}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex items-center gap-3 pt-2 border-t border-brand-border/60">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-brand-orangePrimary text-white text-sm font-bold uppercase tracking-wider shadow-brand-orange hover:bg-brand-orangeBright transition"
          >
            Schedule meeting
          </button>
          <Link href="/meetings" className="text-xs text-brand-textMuted hover:text-brand-textActive">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

// ── Activity at site form ────────────────────────────────────────────────────

function ActivityAtSiteForm({
  sites, wardRows, wardFilter, category, siteQ, unvisitedTotal,
}: {
  sites: { id: string; name: string; type: string; areaName: string | null; wardId: string; wardName: string | null }[];
  wardRows: { id: string; name: string }[];
  wardFilter: string; category: string; siteQ: string; unvisitedTotal: number;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Site picker */}
      <div className="lg:col-span-1 rounded-xl border border-brand-border bg-brand-cardBg p-4 space-y-3">
        <div>
          <div className="text-sm font-bold text-brand-textActive">1. Pick an unvisited site</div>
          <p className="text-[11px] text-brand-textMuted">
            {unvisitedTotal.toLocaleString()} matching unvisited site{unvisitedTotal === 1 ? '' : 's'}.
          </p>
        </div>
        <form method="get" className="space-y-2">
          <input type="hidden" name="action" value="new-activity" />
          <select name="category" defaultValue={category}
            className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-2 py-1.5 text-xs text-brand-textActive focus:outline-none focus:border-brand-skyBlue">
            {SITE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select name="ward" defaultValue={wardFilter}
            className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-2 py-1.5 text-xs text-brand-textActive focus:outline-none focus:border-brand-skyBlue">
            <option value="">All wards</option>
            {wardRows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input
            type="search" name="siteQ" defaultValue={siteQ}
            placeholder="Search site name or area"
            className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-2 py-1.5 text-xs text-brand-textActive placeholder:text-brand-textMuted focus:outline-none focus:border-brand-skyBlue"
          />
          <button className="w-full px-2.5 py-1.5 rounded-md bg-brand-tealBlue text-white text-xs font-semibold">Filter</button>
        </form>
        <div className="max-h-80 overflow-auto pr-1 space-y-1">
          {sites.length === 0 ? (
            <p className="text-[11px] text-brand-textMuted">No unvisited sites match.</p>
          ) : (
            sites.map((s) => (
              <label key={s.id} className="block px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                <input type="radio" name="siteId" value={s.id} form="activity-form" className="accent-brand-orangeBright mr-2" />
                <span className="text-xs font-semibold text-brand-textActive">{s.name}</span>
                <div className="text-[10px] text-brand-textMuted truncate">
                  {s.type.replace(/_/g, ' ')} · {s.wardName ?? '—'}
                  {s.areaName && <> · {s.areaName}</>}
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Activity details form */}
      <form id="activity-form" method="post" action="/api/activities/create" encType="multipart/form-data"
        className="lg:col-span-2 rounded-xl border border-brand-border bg-brand-cardBg p-4 space-y-4">
        <div>
          <div className="text-sm font-bold text-brand-textActive">2. Activity details</div>
          <p className="text-[11px] text-brand-textMuted">Pick a site on the left, then fill these in.</p>
        </div>
        <FieldRow>
          <Field label="Title *" htmlFor="a-title">
            <input id="a-title" name="title" type="text" required maxLength={200}
              placeholder="e.g. Friday baraza at site"
              className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
          </Field>
          <Field label="Type *" htmlFor="a-type">
            <select id="a-type" name="type" required
              className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue">
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Date & time *" htmlFor="a-scheduledAt">
            <input id="a-scheduledAt" name="scheduledAt" type="datetime-local" required
              className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
          </Field>
          <Field label="Expected attendance" htmlFor="a-att">
            <input id="a-att" name="expectedAttendance" type="number" min={0} max={100000}
              className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
          </Field>
        </FieldRow>
        <Field label="Agenda / notes" htmlFor="a-agenda">
          <textarea id="a-agenda" name="agenda" rows={3} maxLength={2000}
            placeholder="What's the purpose, what will happen, who's leading"
            className="w-full bg-brand-cardBgHeavy border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
        </Field>
        <div className="flex items-center gap-3 pt-2 border-t border-brand-border/60">
          <button type="submit"
            className="px-4 py-2 rounded-md bg-brand-orangePrimary text-white text-sm font-bold uppercase tracking-wider shadow-brand-orange hover:bg-brand-orangeBright transition">
            Schedule activity
          </button>
          <Link href="/meetings" className="text-xs text-brand-textMuted hover:text-brand-textActive">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

// ── Unvisited sites finder ──────────────────────────────────────────────────

function UnvisitedSitesFinder({
  sites, wardRows, wardFilter, category, siteQ, unvisitedTotal,
}: {
  sites: { id: string; name: string; type: string; areaName: string | null; wardId: string; wardName: string | null }[];
  wardRows: { id: string; name: string }[];
  wardFilter: string; category: string; siteQ: string; unvisitedTotal: number;
}) {
  return (
    <div className="space-y-4">
      {/* Filter chips for category */}
      <div className="flex flex-wrap gap-1.5">
        {SITE_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/meetings?view=unvisited&category=${c.key}${wardFilter ? `&ward=${wardFilter}` : ''}${siteQ ? `&siteQ=${encodeURIComponent(siteQ)}` : ''}`}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-semibold transition',
              c.key === category
                ? 'bg-brand-tealBlue text-white shadow-brand-teal'
                : 'border border-brand-border text-brand-textMuted hover:text-brand-textActive',
            ].join(' ')}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {/* Filter form */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="view" value="unvisited" />
        <input type="hidden" name="category" value={category} />
        <select name="ward" defaultValue={wardFilter}
          className="bg-brand-cardBg border border-brand-border rounded-md px-3 py-2 text-xs text-brand-textActive focus:outline-none focus:border-brand-skyBlue">
          <option value="">All Nyali wards</option>
          {wardRows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input type="search" name="siteQ" defaultValue={siteQ} placeholder="Search site name / area"
          className="bg-brand-cardBg border border-brand-border rounded-md px-3 py-2 text-xs text-brand-textActive placeholder:text-brand-textMuted focus:outline-none focus:border-brand-skyBlue min-w-[240px]" />
        <button className="px-3 py-2 rounded-md bg-brand-tealBlue text-white text-xs font-semibold">Filter</button>
        <span className="ml-auto text-xs text-brand-textMuted">
          <strong className="text-brand-orangeBright">{unvisitedTotal.toLocaleString()}</strong> unvisited site{unvisitedTotal === 1 ? '' : 's'}
        </span>
      </form>

      {/* Sites list */}
      {sites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-brand-cardBg p-10 text-center">
          <p className="text-sm text-brand-textMuted">
            {unvisitedTotal === 0 ? '🎉 Every site in this filter has been visited.' : 'No sites match — try different filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sites.map((s) => (
            <Link
              key={s.id}
              href={`/wards/${s.wardId}?tab=sites`}
              className="group rounded-xl border border-brand-border bg-brand-cardBg p-4 hover:border-brand-tealBlue/70 hover:shadow-brand-teal transition"
            >
              <div className="text-xs font-bold text-brand-orangeBright uppercase tracking-wider">{s.type.replace(/_/g, ' ')}</div>
              <div className="text-sm font-bold text-brand-textActive mt-1 group-hover:text-brand-skyBlue transition">{s.name}</div>
              <div className="text-[11px] text-brand-textMuted mt-1">
                {s.wardName ?? '—'}
                {s.areaName && <> · {s.areaName}</>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">UNVISITED</span>
                <span className="text-[10px] text-brand-aqua group-hover:text-brand-skyBlue">Open ward →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Plan my month — the PA itinerary builder ─────────────────────────────────
//
// Two stacked jobs on one screen, no JS required:
//   1. "Your itinerary" board — everything already planned, grouped by date,
//      with overdue flagged. Each row can be moved, removed, or marked visited.
//   2. "Where to next?" — every unvisited place clustered Ward → Area inside
//      native <details> accordions. Each place is a one-tap: pick a date → Add.

type PlanSite = {
  id: string; name: string; type: string; areaName: string | null;
  wardId: string; wardName: string | null; plannedVisitAt: Date | null;
};
type ItinSite = PlanSite & { plannedVisitAt: Date; plannedPurpose: string | null };

function PlanMyMonth({
  firstName, unvisited, itinerary, openWard, now,
}: {
  firstName: string;
  unvisited: PlanSite[];
  itinerary: ItinSite[];
  openWard: string;
  now: Date;
}) {
  const monthLabel = now.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  const todayStr = toDateInput(now);
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Itinerary buckets.
  const overdue = itinerary.filter((i) => i.plannedVisitAt < startOfToday);
  const upcoming = itinerary.filter((i) => i.plannedVisitAt >= startOfToday);
  const plannedThisMonth = itinerary.filter((i) => i.plannedVisitAt >= monthStart && i.plannedVisitAt < monthEnd);
  const wardsThisMonth = new Set(plannedThisMonth.map((i) => i.wardId)).size;

  // Upcoming grouped by day.
  const byDay = new Map<string, ItinSite[]>();
  upcoming.forEach((i) => {
    const key = i.plannedVisitAt.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
    (byDay.get(key) ?? byDay.set(key, []).get(key))!.push(i);
  });

  // Unvisited clustered Ward → Area.
  const wardMap = new Map<string, { wardName: string; sites: PlanSite[] }>();
  unvisited.forEach((s) => {
    const g = wardMap.get(s.wardId) ?? { wardName: s.wardName ?? 'Unknown ward', sites: [] };
    g.sites.push(s);
    wardMap.set(s.wardId, g);
  });
  const wardGroups = Array.from(wardMap.entries());
  const plannedIds = new Set(itinerary.map((i) => i.id));

  const redirect = (wardId: string) => `/meetings?action=plan&open=${wardId}#w-${wardId}`;

  return (
    <div className="space-y-6">
      {/* Greeting + at-a-glance stats */}
      <div className="rounded-2xl border border-brand-orangePrimary/40 bg-gradient-to-br from-brand-orangePrimary/15 via-brand-cardBg to-brand-cardBg p-5">
        <h2 className="text-xl font-extrabold text-brand-textActive">
          Habari, {firstName} 👋 — what&apos;s the plan for {monthLabel}?
        </h2>
        <p className="text-sm text-brand-textBody mt-1">
          Pick the places you want to reach below and drop a date on each. They&apos;ll line up into your itinerary — your PA keeps the running list right here.
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Planned this month" value={plannedThisMonth.length} tone="orange" />
          <Stat label="Wards covered" value={wardsThisMonth} tone="teal" />
          <Stat label="Overdue" value={overdue.length} tone={overdue.length ? 'danger' : 'muted'} />
          <Stat label="Still to schedule" value={unvisited.filter((s) => !plannedIds.has(s.id)).length} tone="muted" />
        </div>
      </div>

      {/* ── Itinerary board ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-skyBlue">📋 Your itinerary</h3>
          <span className="text-xs text-brand-textMuted">· {itinerary.length} place{itinerary.length === 1 ? '' : 's'} lined up</span>
        </div>

        {itinerary.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-border bg-brand-cardBg p-8 text-center">
            <p className="text-sm text-brand-textMuted">
              Nothing planned yet. Scroll down to <strong className="text-brand-textActive">“Where to next?”</strong>, pick a place, choose a date, and it lands here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {overdue.length > 0 && (
              <div className="rounded-xl border border-brand-danger/50 bg-brand-danger/5 p-3 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-danger">⚠ Overdue — date has passed, still not logged</div>
                {overdue.map((i) => (
                  <ItineraryRow key={i.id} site={i} todayStr={todayStr} redirect={redirect(i.wardId)} overdue />
                ))}
              </div>
            )}
            {Array.from(byDay.entries()).map(([day, items]) => (
              <div key={day} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-brand-tealBlue/15 px-2 py-0.5 text-xs font-bold text-brand-tealBlue">{day}</span>
                  <span className="text-[11px] text-brand-textMuted">{items.length} stop{items.length === 1 ? '' : 's'}</span>
                </div>
                {items.map((i) => (
                  <ItineraryRow key={i.id} site={i} todayStr={todayStr} redirect={redirect(i.wardId)} />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Where to next — pick places to add ──────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-orangeBright">🎯 Where to next?</h3>
          <span className="text-xs text-brand-textMuted">· {unvisited.length} unvisited place{unvisited.length === 1 ? '' : 's'}, grouped by ward &amp; area</span>
        </div>

        {wardGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-border bg-brand-cardBg p-8 text-center">
            <p className="text-sm text-brand-textMuted">🎉 Every place has been visited. Nothing left to schedule.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {wardGroups.map(([wardId, g]) => {
              const plannedInWard = g.sites.filter((s) => plannedIds.has(s.id)).length;
              // Cluster this ward's sites by area.
              const areaMap = new Map<string, PlanSite[]>();
              g.sites.forEach((s) => {
                const key = s.areaName?.trim() || 'Unspecified area';
                (areaMap.get(key) ?? areaMap.set(key, []).get(key))!.push(s);
              });
              const areas = Array.from(areaMap.entries());
              return (
                <details
                  key={wardId}
                  id={`w-${wardId}`}
                  open={openWard === wardId}
                  className="group rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none hover:bg-black/5">
                    <span className="flex items-center gap-2">
                      <span className="text-brand-textMuted transition-transform group-open:rotate-90">▶</span>
                      <span className="text-sm font-bold text-brand-textActive">{g.wardName}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {plannedInWard > 0 && (
                        <span className="rounded-full bg-brand-tealBlue/15 px-2 py-0.5 text-[10px] font-bold text-brand-tealBlue">{plannedInWard} planned</span>
                      )}
                      <span className="rounded-full bg-brand-orangePrimary/15 px-2 py-0.5 text-[10px] font-bold text-brand-orangeBright">{g.sites.length} to visit</span>
                    </span>
                  </summary>

                  <div className="border-t border-brand-border/60 divide-y divide-brand-border/40">
                    {areas.map(([area, sites]) => (
                      <div key={area} className="px-4 py-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-brand-textMuted mb-2">
                          📍 {area} <span className="text-brand-textMuted/70">· {sites.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {sites.map((s) => (
                            <PickSiteRow key={s.id} site={s} todayStr={todayStr} redirect={redirect(wardId)} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// One planned stop in the itinerary board — move date, remove, or log the visit.
function ItineraryRow({
  site, todayStr, redirect, overdue,
}: {
  site: ItinSite; todayStr: string; redirect: string; overdue?: boolean;
}) {
  const m = typeMeta(site.type);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-cardBg px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-brand-textActive truncate">{m.icon} {site.name}</span>
          {overdue && (
            <span className="text-[10px] font-bold uppercase text-brand-danger">
              {site.plannedVisitAt.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
        <div className="text-[11px] text-brand-textMuted truncate">
          {m.label} · {site.wardName ?? '—'}{site.areaName ? ` · ${site.areaName}` : ''}
          {site.plannedPurpose ? ` · ${site.plannedPurpose}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {/* Move to a new date */}
        <form method="post" action={`/api/sites/${site.id}/quick-plan`} className="flex items-center gap-1">
          <input type="hidden" name="redirect" value={redirect} />
          <input type="date" name="plannedVisitAt" defaultValue={toDateInput(site.plannedVisitAt)} min={todayStr}
            className="bg-brand-cardBgHeavy border border-brand-border rounded-md px-2 py-1 text-xs text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
          <button className="px-2 py-1 rounded-md bg-brand-tealBlue text-white text-[11px] font-semibold hover:bg-brand-tealBright">Move</button>
        </form>
        {/* Mark visited — opens the ward's site tab to log the full visit */}
        <Link href={`/wards/${site.wardId}?tab=sites`}
          className="px-2 py-1 rounded-md border border-brand-success/50 text-brand-success text-[11px] font-semibold hover:bg-brand-success/10">
          ✓ Log
        </Link>
        {/* Remove from plan */}
        <form method="post" action={`/api/sites/${site.id}/quick-plan`}>
          <input type="hidden" name="redirect" value={redirect} />
          <input type="hidden" name="clear" value="1" />
          <button className="px-2 py-1 rounded-md border border-brand-border text-brand-textMuted text-[11px] font-semibold hover:text-brand-danger hover:border-brand-danger/50">✕</button>
        </form>
      </div>
    </div>
  );
}

// One unvisited place — pick a date and add it (or update/remove if already planned).
function PickSiteRow({
  site, todayStr, redirect,
}: {
  site: PlanSite; todayStr: string; redirect: string;
}) {
  const m = typeMeta(site.type);
  const planned = site.plannedVisitAt != null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 flex items-center gap-2">
        <span className="text-sm text-brand-textActive truncate">{m.icon} {site.name}</span>
        <span className="text-[10px] uppercase tracking-wider text-brand-textMuted shrink-0">{m.label}</span>
        {planned && (
          <span className="rounded-full bg-brand-tealBlue/15 px-2 py-0.5 text-[10px] font-bold text-brand-tealBlue shrink-0">
            ✓ {site.plannedVisitAt!.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <form method="post" action={`/api/sites/${site.id}/quick-plan`} className="flex items-center gap-1">
          <input type="hidden" name="redirect" value={redirect} />
          <input type="date" name="plannedVisitAt" min={todayStr}
            defaultValue={planned ? toDateInput(site.plannedVisitAt!) : ''}
            className="bg-brand-cardBgHeavy border border-brand-border rounded-md px-2 py-1 text-xs text-brand-textActive focus:outline-none focus:border-brand-skyBlue" />
          <button className={[
            'px-2.5 py-1 rounded-md text-white text-[11px] font-bold transition',
            planned ? 'bg-brand-tealBlue hover:bg-brand-tealBright' : 'bg-brand-orangePrimary hover:bg-brand-orangeBright',
          ].join(' ')}>
            {planned ? 'Update' : '＋ Add'}
          </button>
        </form>
        {planned && (
          <form method="post" action={`/api/sites/${site.id}/quick-plan`}>
            <input type="hidden" name="redirect" value={redirect} />
            <input type="hidden" name="clear" value="1" />
            <button className="px-2 py-1 rounded-md border border-brand-border text-brand-textMuted text-[11px] hover:text-brand-danger hover:border-brand-danger/50">✕</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'orange' | 'teal' | 'danger' | 'muted' }) {
  const toneCls = {
    orange: 'text-brand-orangeBright',
    teal: 'text-brand-tealBlue',
    danger: 'text-brand-danger',
    muted: 'text-brand-textActive',
  }[tone];
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg px-3 py-2.5">
      <div className={`text-2xl font-extrabold ${toneCls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-bold mt-0.5">{label}</div>
    </div>
  );
}

// ── Reusable bits ────────────────────────────────────────────────────────────

function ModeTab({
  href, active, tone, children,
}: {
  href: string; active: boolean; tone?: 'orange'; children: React.ReactNode;
}) {
  const activeCls = tone === 'orange'
    ? 'bg-brand-orangePrimary text-white shadow-brand-orange'
    : 'bg-brand-tealBlue text-white shadow-brand-teal';
  return (
    <Link
      href={href}
      className={[
        'px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition',
        active ? activeCls : 'border border-brand-border text-brand-textMuted hover:text-brand-textActive',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[10px] uppercase tracking-wider font-bold text-brand-textMuted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Flash({ tone, children }: { tone: 'success' | 'danger'; children: React.ReactNode }) {
  const cls = tone === 'success'
    ? 'border-brand-success/50 bg-brand-success/10 text-brand-success'
    : 'border-brand-danger/50 bg-brand-danger/10 text-brand-danger';
  return (
    <div className={`rounded-lg border px-4 py-2 text-sm ${cls}`}>{children}</div>
  );
}
