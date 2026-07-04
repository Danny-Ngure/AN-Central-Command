import { db, people, wards } from '@an/db';
import { eq, isNull, and, sql } from 'drizzle-orm';
import Link from 'next/link';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { isSuperAdmin } from '@/lib/admin';
import { PhoneActions } from '@/components/phone-actions';
import { AddMemberForm } from '@/components/add-member-form';
import { WaremboRoster } from '@/components/warembo-roster';
import { WardTeamRoster } from '@/components/ward-team-roster';
import { WARD_TEAMS, WARD_TEAM_BY_NAME } from '@/data/ward-teams';
import { FlamesCrew } from '@/components/flames-crew';
import { FlamesRoster } from '@/components/flames-roster';
import { FLAMES_CREW, FLAMES_ROSTER, FLAMES_ROSTER_COUNT, FLAMES_WARD_PREFIX } from '@/data/alfayo-flames';
import { MemberRegistry, type RegInput, type Band } from '@/lib/member-registry';

// Roles allowed to add team members through the directory (mirrors the API gate).
const CAN_ADD_MEMBERS = new Set([
  'candidate', 'campaign_manager', 'chief_strategist', 'constituency_coordinator', 'tech_lead',
]);

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
  'Irene Mkamburi',
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

// Warembo wa Alfayo rank-and-file registration roster, grouped by ward (from the
// REGISTRATION ROSTER doc). Office bearers above are featured as cards; these members
// are listed below them under "See other members". Office bearers already shown as
// cards (e.g. Caroline Ruwa, Diana Hildah Ogoye) are intentionally omitted here to
// avoid double-listing. Phone numbers kept in the local format from the roster.
export const WAREMBO_ROSTER: { ward: string; members: { name: string; phone: string; area?: string; id?: string }[] }[] = [
  {
    ward: 'Mkomani Ward',
    members: [
      { name: 'Laura Wambui', phone: '0798645410' },
      { name: 'Diana Akinyi', phone: '0723875623' },
      { name: 'Josephine David', phone: '0746303735' },
      { name: 'Priscillah Wambui', phone: '0707402704' },
      { name: 'Millicent Mercy', phone: '0702772804' },
      { name: 'Josephine Achienge', phone: '0769749470' },
      { name: 'Roselida Masiga', phone: '0795649266' },
      { name: 'Lucy Ajiambo', phone: '0797372120' },
      { name: 'Maria Giani', phone: '0711528232' },
      { name: 'Tatiana Muthoni', phone: '0743390595' },
      { name: 'Neema Melissa', phone: '0112566433' },
      { name: 'Velma Ochol', phone: '0111334307' },
      { name: 'Vivian Benson', phone: '0704968863' },
      { name: 'Sabina Akinyi', phone: '0769881707' },
      { name: 'Doreen Ajiambo', phone: '0113913346' },
      { name: 'Benter Wasonga', phone: '0796008944' },
      { name: 'Nelly Wambui', phone: '0702756319' },
      { name: 'Jennifer Lorna', phone: '0700867172' },
      { name: 'Marisela Odongo', phone: '0791857593' },
      { name: 'Monica Omburo', phone: '0757431250' },
      { name: 'Beril Echesa', phone: '0743908258' },
      { name: 'Faith Joseph', phone: '0705583222' },
      { name: 'Mourine Atieno', phone: '0119096305' },
      { name: 'Helen Milisi', phone: '0707437478' },
      { name: 'Rosemary Manase', phone: '0768417018' },
      { name: 'Brenda Achieng', phone: '0790615978' },
      { name: 'Florence Chao', phone: '0795377032' },
      { name: 'Maurine Achieng', phone: '0792416208' },
      { name: 'Nereah Muthoni', phone: '0793939217' },
      { name: 'Mercy Auma Odhiambo', phone: '0712156983' },
      { name: 'Ivana Oranga', phone: '0741867610' },
      { name: 'Camilla Achiend', phone: '0795485839' },
      { name: 'Addlide Agola', phone: '0111800007' },
      { name: 'Purity Atieno', phone: '0791259663' },
      { name: 'Lydia Maina', phone: '0790380349' },
      { name: 'Bernadet Juma', phone: '0743096513' },
      { name: 'Mary Onyango', phone: '0797075732' },
      { name: 'Latifa Juma', phone: '0795987229' },
      { name: 'Winnie Adhiambo', phone: '0714189199' },
      { name: 'Glory Maku', phone: '0758745526' },
      { name: 'Berlin Awuor', phone: '0741573984' },
      { name: 'Cynthia Bwire', phone: '0115261861' },
      { name: 'Loreen Achieng', phone: '0741593077' },
      { name: 'Maureen Atieno Oyugi', phone: '0707702871' },
      { name: 'Anjela Ndeta', phone: '0728137897' },
      { name: 'Winrose Kadenge', phone: '0743986968' },
      { name: 'Cynthia Atieno', phone: '0729870970' },
    ],
  },
  {
    ward: 'Kadzandani Ward',
    members: [
      { name: 'Rehema Masha', phone: '0712451650', area: 'Bullo' },
      { name: 'Janet Kahindi', phone: '0716778117', area: 'Soweto' },
      { name: 'Happy Munga', phone: '0703853173', area: 'Kadzandani' },
      { name: 'Bianca Akinyi', phone: '0115489778', area: 'Bashir' },
      { name: 'Grace Mwikali', phone: '0111856652', area: 'Bullo' },
      { name: 'Husna Teka', phone: '0113158877', area: 'Bashir' },
      { name: 'Mariam Khamis', phone: '0712320791', area: 'Teman' },
      { name: 'Margaret Karanja', phone: '0711374588', area: 'Bullo' },
      { name: 'Farida Athman', phone: '0727948003', area: 'Ziwa la Ngombe' },
      { name: 'Sada Mohammed', phone: '0795372711', area: 'Bullo' },
      { name: 'Dessy Awuor', phone: '0757845251', area: 'Bashir' },
      { name: 'Evangeline Mwendwa', phone: '0748133039', area: 'Bullo' },
      { name: 'Eunice F. Luande', phone: '0712619568', area: 'Teman' },
      { name: 'Mwanaisha Mohammad', phone: '0754320321', area: 'Bullo' },
      { name: 'Aisha Said', phone: '0723813455', area: 'Bullo' },
      { name: 'Josephine Safari', phone: '0759392364', area: 'Soweto' },
      { name: 'Josephine Etenyi', phone: '0791587497', area: 'Bullo' },
      { name: 'Salma Ronald', phone: '0715019903', area: 'Bullo' },
      { name: 'Amina Konzi', phone: '0706118893', area: 'Bullo' },
      { name: 'Jenny Anyango', phone: '0740851821', area: 'Ziwa la Ngombe' },
      { name: 'Shemina Mweni', phone: '0746764385', area: 'Mwatamba' },
      { name: 'Khadija Charo', phone: '0794714016', area: 'Bullo' },
      { name: 'Kazos Kenga', phone: '0115658030', area: 'Kadzandani' },
      { name: 'Khadija Katana', phone: '0119118214', area: 'Kadzandani' },
      { name: 'Lilian Lewa', phone: '0798261631', area: 'Kadzandani' },
      { name: 'Swabrina Sarah', phone: '0740178625', area: 'Bullo' },
      { name: 'Rukia Juma', phone: '0794533054', area: 'Bullo' },
      { name: 'Dorothy Mkala', phone: '0740384760', area: 'Soweto' },
      { name: 'Najma Talib', phone: '0701165613', area: 'Bullo' },
      { name: 'Lilian Mkala', phone: '0769930648', area: 'Kadzandani' },
      { name: 'Grace', phone: '0743164509', area: 'Kadzandani' },
    ],
  },
  {
    ward: 'Kongowea Ward',
    members: [
      { name: 'Zawadi Karisa', phone: '0741953627', id: '969397173' },
      { name: 'Fatma Athman', phone: '0769390601', id: '37274112' },
      { name: 'Umi Seif', phone: '0115402621', id: '170526583' },
      { name: 'Amina Ayub', phone: '0757553088', id: '36462146' },
      { name: 'Beatrice Akinyi', phone: '0799508180', id: '38484833' },
      { name: 'Elizabeth Musumba', phone: '0113646147', id: '41311564' },
      { name: 'Patience Kulola', phone: '0116517012', id: '42074821' },
      { name: 'Mwanahamisi Swaleh', phone: '0705218587', id: '29873929' },
      { name: 'Priscilla Makatu', phone: '0702186618', id: '32806691' },
      { name: 'Brenda Khagali', phone: '0110474755', id: '37515481' },
      { name: 'Diana Akinyi', phone: '0742542656', id: '41813862' },
      { name: 'Consolata Akinyi', phone: '0740470631', id: '42820767' },
      { name: 'Esther Alusa', phone: '0787896531', id: '29811909' },
      { name: 'Ummy Mwagandi', phone: '0116511067', id: '38707985' },
      { name: 'Najma Atman', phone: '0797843438', id: '32834092' },
      { name: 'Sharon Awuor', phone: '0114791152', id: '41950836' },
      { name: 'Hawa Thuo', phone: '0795778412', id: '34168231' },
      { name: 'Lyne Muthoni', phone: '0757192956', id: '37982572' },
      { name: 'Hellen Wakesho', phone: '0768059655', id: '836764076' },
      { name: 'Fatma Iddi', phone: '0725859854', id: '825453611' },
      { name: 'Saumu Adam', phone: '0740322889', id: '37650135' },
      { name: 'Sara Wanjohi', phone: '0742005470', id: '33843080' },
      { name: 'Mariam Mohamed', phone: '0111865567', id: '472991248' },
      { name: 'Mary Mitchell', phone: '0715534218', id: '348128157' },
      { name: 'Mkasi Hamisi', phone: '0741638547', id: '40094875' },
      { name: 'Grece Mshimba', phone: '0707348824', id: '32172082' },
      { name: 'Sharon Mukuna', phone: '0114488495', id: '41474582' },
      { name: 'Seline Juma', phone: '0799532588', id: '39390768' },
      { name: 'Maimuna Mohammed', phone: '0112509504', id: '42898432' },
      { name: 'Farida Mbarak', phone: '0114547361', id: '39493135' },
      { name: 'Bibi Omar', phone: '0717430959', id: '29529866' },
      { name: 'Damaris Atuga', phone: '0724935918', area: 'Kambi Kikuyu' },
    ],
  },
  {
    ward: "Ziwa La Ng'ombe Ward",
    members: [
      { name: 'Dama Baya', phone: '0724976672', id: '29368771' },
      { name: 'Rachel Sidi Kahindi', phone: '0741452818', id: '33460066' },
      { name: 'Grace Aoko', phone: '0799885976', id: '42772192' },
      { name: 'Mwanahawa Hidaya Chivatsi', phone: '0703596944', id: '30297584' },
      { name: 'Rukiya Kazzi Hussein', phone: '0114281664', id: '41867264' },
      { name: 'Grace Atieno', phone: '0714858198', id: '38542530' },
      { name: 'Esther Reymond', phone: '0748403779', id: '31000838' },
      { name: 'Paulina Mambea', phone: '0723883091', id: '27928443' },
      { name: 'Cynthia Agutu', phone: '0116261861', id: '40094894' },
      { name: 'Caroline Wakio Mambea', phone: '0707711185', id: '389951020' },
      { name: 'Hellen Sophy', phone: '0117677579', id: '98447918' },
      { name: 'Sofia Katana', phone: '0743952507', id: '38205973' },
      { name: 'Alice Dama Charo', phone: '0705829855', id: '31023406' },
      { name: 'Irene Yangi Ateka', phone: '0792229362', id: '42066107' },
      { name: 'Linet Bahati Sadaka', phone: '0715420897', id: '27115636' },
      { name: 'Anjelin Bahati Kalume', phone: '0701623803', id: '35846250' },
      { name: 'Zeinab Kake Athumani', phone: '0758398910', id: '688449697' },
      { name: 'Monicah Kaveke', phone: '0716571396', id: '33968691' },
      { name: 'Hafswa Ramadhan', phone: '0740732252', id: '42965733' },
      { name: 'Faith Nzina', phone: '0110765024', id: '30888898' },
      { name: 'Everlyne Malusha', phone: '0708393038', id: '41833407' },
      { name: 'Norin Makau', phone: '0701535012', id: '30914515' },
      { name: 'Winimah Moguche Gesare', phone: '0757714205', id: '38696660' },
      { name: 'Lucia Kathini', phone: '0743732254', id: '34276847' },
      { name: 'Naima Tabu', phone: '0791563438', id: '32411546' },
    ],
  },
  {
    ward: 'Frere Town Ward',
    members: [
      { name: 'Irene Mkamburi', phone: '0715562217', id: '38583776' },
      { name: 'Serena Neema', phone: '0117355475', id: '946510751' },
      { name: 'Pili Adel', phone: '0754757886', id: '679573531' },
      { name: 'Faith Mwaura', phone: '0768762055', id: '22978033' },
      { name: 'Zenna', phone: '0115856540', id: '716958174' },
      { name: 'Lancy', phone: '0118497542', id: '549599549' },
      { name: 'Mary', phone: '' },
      { name: 'Salma Bernard', phone: '0111990139' },
      { name: 'Mariam Mody', phone: '0700032444', id: '32950706' },
      { name: 'Sofia', phone: '0794934308', id: '41953999' },
      { name: 'Priscah', phone: '0795178395', id: '38798949' },
      { name: 'Sonnie', phone: '0700057559', id: '42400440' },
      { name: 'Veroh', phone: '0757026105' },
      { name: 'Qauthar', phone: '0117759880', id: '265708715' },
      { name: 'Mwaka', phone: '0792795715', id: '28018404' },
      { name: 'Emily', phone: '0757171320', id: '36647308' },
      { name: 'Amina', phone: '0797027077', id: '36647308' },
      { name: 'Faith Rasoa', phone: '0110529277', id: '632286122' },
      { name: 'Naima', phone: '0720426646', id: '41803156' },
      { name: 'Bishara Anwar', phone: '0790412471', id: '37322605' },
      { name: 'Tima', phone: '0118994958', id: '588391567' },
      { name: 'Serah', phone: '0717972635', id: '38559008' },
      { name: 'Sandra', phone: '0713147766', id: '874748961' },
      { name: 'Nuru Said Mwambire', phone: '079714641', id: '42959597' },
    ],
  },
];
const WAREMBO_ROSTER_COUNT = WAREMBO_ROSTER.reduce((sum, g) => sum + g.members.length, 0);

// Per-ward breakdown for the Petals of Alfayo stat strip (label without the
// trailing " Ward" for compact tiles).
const WAREMBO_WARD_BREAKDOWN = WAREMBO_ROSTER.map((g) => ({
  ward: g.ward.replace(/ Ward$/, ''),
  count: g.members.length,
}));


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

type Group = 'members' | 'executive' | 'wards' | 'warembo' | 'flames' | 'all';

// Normalised row for the compact "Members list" view (works for DB people and
// static roster members alike).
type MemberRowData = {
  key: string;
  name: string;
  photo: string | null;
  memberId: string | null;
  subtitle: string;
  ward: string | null;
  phone: string | null;
  nationalId: string | null;
  station: string | null;
  stationCode: string | null;
  isSuper: boolean;
  profileHref: string | null;
};

// Soft, eye-friendly tint per ward (used for the Members list ward blocks and the
// per-ward sub-blocks inside the Warembo / Flames boxes).
const WARD_TINTS: Record<string, { bg: string; border: string }> = {
  'Frere Town': { bg: '#EAF2FB', border: '#CBE0F5' },
  Kadzandani: { bg: '#FCEFE3', border: '#F3D9C2' },
  Kongowea: { bg: '#EAF6EC', border: '#CDE9D3' },
  Mkomani: { bg: '#E7F5F4', border: '#C7E7E4' },
  "Ziwa La Ng'ombe": { bg: '#FBF3DD', border: '#EFE1B8' },
};
function wardTint(name: string): { bg: string; border: string } {
  return WARD_TINTS[name] ?? { bg: '#F4F1EB', border: '#E4DED2' };
}
// URL-safe anchor slug so a ward chip can jump straight to that ward's block.
const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

export default async function TeamPage({ searchParams }: { searchParams: { group?: string; pane?: string } }) {
  const claims = await getServerAuthOrRedirect();
  // Hidden admin/placeholder accounts are visible only to the super admin (Dan).
  const viewerIsSuper = await isSuperAdmin(claims.sub);
  // Which "page" within the Members view is open (a ward slug, 'warembo', 'flames',
  // 'aspirant', 'none', or '' for the index).
  const pane = (searchParams.pane ?? '').toString();
  const group: Group = (['members', 'executive', 'wards', 'warembo', 'flames'].includes(searchParams.group ?? '')
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
        nationalId: people.nationalId,
      })
      .from(people)
      .where(
        and(
          eq(people.active, true),
          isNull(people.deletedAt),
          // Directory shows only real members. Exclude login-only accounts:
          //   • Dan's "View-As" preview logins ('Preview account')
          //   • the bulk Warembo/Flames/ward-team login rows that were added just so
          //     those people could sign in — they'd otherwise double-count against the
          //     built-in rosters that already display them.
          sql`(${people.title} IS NULL OR ${people.title} NOT IN ('Preview account', 'Warembo wa Alfayo', 'Alfayo Flames', 'Ward teams'))`,
          // Placeholder / admin accounts are hidden from everyone except the super admin.
          viewerIsSuper ? undefined : eq(people.hidden, false),
        ),
      )
      .orderBy(people.fullName);

    const wardRows = await db.select({ id: wards.id, name: wards.name }).from(wards).orderBy(wards.name);
    const wardName = new Map(wardRows.map((w) => [w.id, w.name]));
    return { peopleRows, wardName, wardOrder: wardRows.map((w) => w.id) };
  })();

  // IEBC enrichment — match every team member (DB people + ward teams + Warembo +
  // Flames) against the voter register by National ID, PHONE (last 9 digits), and
  // NAME, then attach their polling station. Name matches are only trusted when
  // unambiguous (all hits point to the same station) to avoid same-name mix-ups.
  type Station = { station: string | null; code: string | null; ward: string | null };
  const digitsOnly = (s?: string | null) => (s ?? '').replace(/\D/g, '');
  const last9 = (s?: string | null) => { const d = digitsOnly(s); return d.length >= 9 ? d.slice(-9) : ''; };
  const nameToks = (s?: string | null) => (s ?? '').toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const nameKey = (s?: string | null) => [...nameToks(s)].sort().join(''); // order-independent

  const refs: { id?: string | null; phone?: string | null; name: string }[] = [
    ...data.peopleRows.map((p) => ({ id: p.nationalId, phone: p.phone, name: p.fullName })),
    ...WARD_TEAMS.flatMap((t) => t.members.map((m) => ({ id: m.id, phone: m.phone, name: m.name }))),
    ...WAREMBO_ROSTER.flatMap((g) => g.members.map((m) => ({ id: m.id, phone: m.phone, name: m.name }))),
    ...FLAMES_CREW.map((m) => ({ id: null, phone: m.phone, name: m.name })),
    ...FLAMES_ROSTER.flatMap((g) => g.members.map((m) => ({ id: null, phone: m.phone, name: m.name }))),
  ];
  const ids = Array.from(new Set(refs.map((r) => r.id).filter((x): x is string => !!x)));
  const phones = Array.from(new Set(refs.map((r) => last9(r.phone)).filter(Boolean)));
  const nameConcats = new Set<string>();
  for (const r of refs) {
    const t = nameToks(r.name);
    if (t.length >= 2) { nameConcats.add(t.join('')); nameConcats.add([...t].reverse().join('')); }
  }
  const nameList = Array.from(nameConcats);

  const pollingByNid: Record<string, Station> = {};
  const pollingByPhone: Record<string, Station> = {};
  const pollingByName: Record<string, Station> = {};
  const conds: any[] = [];
  if (ids.length) conds.push(sql`v.national_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  if (phones.length) conds.push(sql`RIGHT(REGEXP_REPLACE(COALESCE(v.phone, ''), '[^0-9]', '', 'g'), 9) IN (${sql.join(phones.map((p) => sql`${p}`), sql`, `)})`);
  if (nameList.length) {
    const nl = sql.join(nameList.map((n) => sql`${n}`), sql`, `);
    conds.push(sql`UPPER(REGEXP_REPLACE(v.surname || v.first_name, '[^A-Za-z0-9]', '', 'g')) IN (${nl})`);
    conds.push(sql`UPPER(REGEXP_REPLACE(v.first_name || v.surname, '[^A-Za-z0-9]', '', 'g')) IN (${nl})`);
  }
  if (conds.length > 0) {
    const whereExpr = sql.join(conds, sql` OR `);
    const rows = (await db.execute(sql`
      SELECT v.national_id AS nid, v.phone AS phone, v.surname AS surname, v.first_name AS fname,
             w.name AS ward_name, ps.name AS ps_name, ps.iebc_code AS ps_code
      FROM voters v
      LEFT JOIN wards w ON w.id = v.ward_id
      LEFT JOIN polling_stations ps ON ps.id = v.polling_station_id
      WHERE v.consent_withdrawn_at IS NULL AND (${whereExpr})
    `)) as any[];
    const nameHits: Record<string, Station[]> = {};
    for (const r of rows) {
      const station: Station = { station: r.ps_name ?? null, code: r.ps_code ?? null, ward: r.ward_name ?? null };
      if (r.nid) pollingByNid[String(r.nid)] = station;
      const p9 = last9(r.phone);
      if (p9) pollingByPhone[p9] = station;
      const k = nameKey((r.surname ?? '') + ' ' + (r.fname ?? ''));
      if (k) { if (!nameHits[k]) nameHits[k] = []; nameHits[k].push(station); }
    }
    for (const [k, hits] of Object.entries(nameHits)) {
      if (new Set(hits.map((h) => h.station ?? '')).size === 1) pollingByName[k] = hits[0];
    }
  }
  const pollingFor = (id?: string | null, phone?: string | null, name?: string | null): Station | undefined => {
    if (id && pollingByNid[id]) return pollingByNid[id];
    const p9 = last9(phone);
    if (p9 && pollingByPhone[p9]) return pollingByPhone[p9];
    const k = nameKey(name);
    if (k && pollingByName[k]) return pollingByName[k];
    return undefined;
  };

  const isWardRole = (role: string) =>
    role === 'ward_coordinator' || role === 'assistant_ward_coordinator';
  const isWarembo = (p: PersonRow) =>
    WAREMBO_NAMES.has(p.fullName) || (p.title ?? '').toLowerCase().includes('warembo');

  // ── Executive + Technical Team (two sub-groups) ────────────────────────
  const TECH_ROLES = new Set(['tech_lead', 'media_head', 'comms_head']);
  // Executive Team = the leadership dockets only (from EXEC_ROLE_ORDER, minus the
  // technical roles which get their own sub-group). Grassroots field roles —
  // canvasser, polling_agent, polling_station_lead — are NOT executive; they appear
  // under their ward in the Grassroots & Ward Coordination section instead.
  const EXECUTIVE_ROLES = new Set(EXEC_ROLE_ORDER.filter((r) => !TECH_ROLES.has(r)));
  // People who should appear in the Executive Team regardless of their role/group
  // (e.g. they also sit on the Warembo docket but lead at the executive level).
  const FORCE_EXECUTIVE = new Set(['Irene Mkamburi']);
  // Explicit pecking-order overrides by name (win over role-based order). Irene sits
  // immediately AFTER Cavins Omino (campaign_manager = index 4), per campaign
  // direction. This is display order only — her admin role/privileges are unchanged.
  const EXEC_NAME_RANK: Record<string, number> = { 'Irene Mkamburi': 4.5 };
  const execRank = (p: PersonRow) => {
    if (p.fullName in EXEC_NAME_RANK) return EXEC_NAME_RANK[p.fullName];
    const i = EXEC_ROLE_ORDER.indexOf(p.role);
    return i === -1 ? 99 : i;
  };
  const execSort = (a: PersonRow, b: PersonRow) => {
    const ar = execRank(a);
    const br = execRank(b);
    if (ar !== br) return ar - br;
    return a.fullName.localeCompare(b.fullName);
  };
  const executive = data.peopleRows
    .filter((p) => FORCE_EXECUTIVE.has(p.fullName) || (!isWardRole(p.role) && !isWarembo(p) && EXECUTIVE_ROLES.has(p.role)))
    .sort(execSort);
  const technical = data.peopleRows
    .filter((p) => !isWardRole(p.role) && !isWarembo(p) && TECH_ROLES.has(p.role) && !FORCE_EXECUTIVE.has(p.fullName))
    .sort(execSort);

  // ── Canonical member-ID registry (one ward-prefixed ID per person) ──────────
  // Bands: 1 Executive · 2 Coordinators · 3 Technical · 4 Area leaders · 5 Members.
  // Ward teams keep the ward prefix; Warembo and Flames have their own; a DB-held
  // ID (e.g. MKM002) sticks with the person even inside another crew.
  const WARD_PREFIX: Record<string, string> = {
    'Frere Town': 'FRT', Kadzandani: 'KAD', Kongowea: 'KON', Mkomani: 'MKM', "Ziwa La Ng'ombe": 'ZIW',
  };
  const WAREMBO_PREFIX: Record<string, string> = {
    'Mkomani Ward': 'WMK', 'Kadzandani Ward': 'WAKD', 'Kongowea Ward': 'WAKO',
    'Frere Town Ward': 'WAFT', "Ziwa La Ng'ombe Ward": 'WAZW',
  };
  const execIds = new Set(executive.map((p) => p.id));
  const techIds = new Set(technical.map((p) => p.id));
  const photoOf = (p: PersonRow) =>
    p.photoUrl ? `${p.photoUrl}?v=${p.lastActiveAt ? new Date(p.lastActiveAt).getTime() : 0}` : null;
  const bandForPerson = (p: PersonRow): Band => {
    if (execIds.has(p.id)) return 1;
    if (p.role === 'ward_coordinator' || p.role === 'assistant_ward_coordinator') return 2;
    if (techIds.has(p.id)) return 3;
    if (p.role === 'canvasser' || p.role === 'polling_agent') return 5;
    return 4; // influence_liaison, polling_station_lead, Warembo office bearers, others
  };
  const dbPrefix = (p: PersonRow): string =>
    p.teamId?.match(/^[A-Za-z]+/)?.[0] ??
    (p.wardId ? WARD_PREFIX[data.wardName.get(p.wardId) ?? ''] : undefined) ??
    'AN';
  const regInputs: RegInput[] = [
    ...data.peopleRows.map((p) => ({
      name: p.fullName,
      phone: p.phone,
      nationalId: p.nationalId,
      photoSrc: photoOf(p),
      band: bandForPerson(p),
      prefix: dbPrefix(p),
      existingId: p.teamId,
      crewRank: 0,
    })),
    ...WARD_TEAMS.flatMap((t) =>
      t.members.map((m) => ({
        name: m.name, phone: m.phone, nationalId: m.id, band: 5 as Band, prefix: t.prefix, existingId: null, crewRank: 0,
      })),
    ),
    ...WAREMBO_ROSTER.flatMap((g) =>
      g.members.map((m) => ({
        name: m.name, phone: m.phone, nationalId: m.id, band: 5 as Band, prefix: WAREMBO_PREFIX[g.ward] ?? 'WA', existingId: null, crewRank: 1,
      })),
    ),
    ...FLAMES_CREW.map((m) => ({
      name: m.name, phone: m.phone, band: 4 as Band, prefix: 'ALF', existingId: null, crewRank: 2,
    })),
    ...FLAMES_ROSTER.flatMap((g) =>
      g.members.map((m) => ({
        name: m.name, phone: m.phone, band: 5 as Band, prefix: FLAMES_WARD_PREFIX[g.ward] ?? 'FL', existingId: null, crewRank: 2,
      })),
    ),
  ];
  const registry = new MemberRegistry(regInputs);
  const memberIdOf = (p: PersonRow) => registry.resolve(p.fullName, p.phone, p.nationalId)?.memberId ?? p.teamId;

  // Enriched roster data (canonical IDs + photos + polling) for the client rosters.
  const waremboGroups = WAREMBO_ROSTER.map((g) => ({
    ward: g.ward,
    members: g.members.map((m) => {
      const r = registry.resolve(m.name, m.phone, m.id);
      const hit = pollingFor(m.id, m.phone, m.name);
      return {
        ...m,
        memberId: r?.memberId ?? '—',
        photoSrc: r?.photoSrc ?? null,
        station: hit?.station ?? null,
        stationCode: hit?.code ?? null,
      };
    }),
  }));
  const flamesMembers = FLAMES_CREW.map((m) => {
    const r = registry.resolve(m.name, m.phone, null);
    return {
      ...m,
      memberId: r?.memberId ?? '—',
      agentId: r?.agentId ?? '—',
      photoSrc: r?.photoSrc ?? null,
    };
  });
  const flamesGroups = FLAMES_ROSTER.map((g) => ({
    ward: g.ward,
    members: g.members.map((m) => {
      const r = registry.resolve(m.name, m.phone, null);
      return {
        ...m,
        memberId: r?.memberId ?? '—',
        agentId: r?.agentId ?? '—',
        photoSrc: r?.photoSrc ?? null,
      };
    }),
  }));

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
  const byWard = new Map<string, PersonRow[]>();
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

  const canAddMembers = CAN_ADD_MEMBERS.has(claims.role);
  const wardList = data.wardOrder.map((id) => ({ id, name: data.wardName.get(id) ?? id }));

  const showMembers = group === 'members';
  const showExec = group === 'all' || group === 'executive';
  const showWards = group === 'all' || group === 'wards';
  const showWarembo = group === 'all' || group === 'warembo';
  const showFlames = group === 'all' || group === 'flames';

  // Normalisers → MemberRowData, for the clustered Members list.
  const rowFromPerson = (p: PersonRow, showWard = true): MemberRowData => {
    const nid = p.nationalId;
    const poll = pollingFor(nid, p.phone, p.fullName);
    return {
      key: p.id,
      name: p.fullName,
      photo: photoOf(p),
      memberId: memberIdOf(p) ?? null,
      subtitle: ROLE_LABEL[p.role] ?? p.role,
      ward: showWard && p.wardId ? data.wardName.get(p.wardId) ?? null : null,
      phone: p.phone ?? null,
      nationalId: nid ?? null,
      station: poll?.station ?? null,
      stationCode: poll?.code ?? null,
      isSuper: SUPER_USER_NAMES.has(p.fullName),
      profileHref: `/team/${p.id}`,
    };
  };
  const rowFromRoster = (
    m: { name: string; phone?: string; id?: string; area?: string; title?: string },
    wardLabel: string | null,
  ): MemberRowData => {
    const r = registry.resolve(m.name, m.phone, m.id ?? null);
    const poll = pollingFor(m.id, m.phone, m.name);
    return {
      key: (m.id ?? m.name) + ':' + (wardLabel ?? ''),
      name: m.name,
      photo: r?.photoSrc ?? null,
      memberId: r?.memberId ?? null,
      subtitle: m.title ?? (m.area ? m.area : 'Member'),
      ward: wardLabel,
      phone: m.phone ?? null,
      nationalId: m.id ?? null,
      station: poll?.station ?? null,
      stationCode: poll?.code ?? null,
      isSuper: false,
      profileHref: null,
    };
  };
  const shortWard = (w: string) => w.replace(/ Ward$/, '');
  const memberIdSort = (a: PersonRow, b: PersonRow) =>
    (memberIdOf(a) ?? 'zzz999').localeCompare(memberIdOf(b) ?? 'zzz999');

  // The Aspirant sits at the very top on his own; everyone else is grouped by their
  // HOME ward (Ward Rep → Assistants → rest, each by ID). No Executive/Technical
  // categories in this view — just wards.
  const alfayo =
    data.peopleRows.find((p) => p.role === 'candidate') ??
    data.peopleRows.find((p) => p.fullName === 'Alfayo Nelson') ??
    null;
  const normName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Complete ward roster = registered DB people (home ward) + the ward's field-team
  // roster from data/ward-teams.ts, de-duplicated by name. Ward Rep → Assistants →
  // rest. This is what makes the Members page match the actual ward teams.
  const wardBuckets = data.wardOrder
    .map((wId) => {
      const wName = data.wardName.get(wId) ?? '—';
      const db = data.peopleRows
        .filter((p) => p.wardId === wId && p.id !== alfayo?.id)
        .sort((a, b) => wardRank(a) - wardRank(b) || memberIdSort(a, b));
      const dbNames = new Set(db.map((p) => normName(p.fullName)));
      const dbRows = db.map((p) => rowFromPerson(p, true));
      const team = WARD_TEAM_BY_NAME[wName]?.members ?? [];
      const fieldRows = team
        .filter((m) => !dbNames.has(normName(m.name)))
        .map((m) => rowFromRoster({ name: m.name, phone: m.phone, id: m.id, area: m.village }, shortWard(wName)));
      return { wId, name: wName, rows: [...dbRows, ...fieldRows] };
    })
    .filter((b) => b.rows.length > 0);
  const leftover = data.peopleRows
    .filter((p) => !p.wardId && p.id !== alfayo?.id)
    .sort(memberIdSort)
    .map((p) => rowFromPerson(p, true));
  const totalTeam =
    (alfayo ? 1 : 0) + wardBuckets.reduce((s, b) => s + b.rows.length, 0) + leftover.length;
  const selectedWard = wardBuckets.find((b) => slug(b.name) === pane);

  // Warembo / Flames are support groups (not the core team) — each split into its
  // own per-ward pages. pane looks like 'warembo-<wardSlug>' | 'warembo-office'.
  const dash = pane.indexOf('-');
  const panePrefix = dash > 0 ? pane.slice(0, dash) : pane;
  const paneKey = dash > 0 ? pane.slice(dash + 1) : '';
  const waremboRows = (key: string): { label: string; rows: MemberRowData[] } | null => {
    if (key === 'office') return { label: 'Office bearers', rows: warembo.map((p) => rowFromPerson(p, true)) };
    const g = WAREMBO_ROSTER.find((gr) => slug(shortWard(gr.ward)) === key);
    return g ? { label: `${shortWard(g.ward)} Ward`, rows: g.members.map((m) => rowFromRoster(m, shortWard(g.ward))) } : null;
  };
  const flamesRows = (key: string): { label: string; rows: MemberRowData[] } | null => {
    if (key === 'office') return { label: 'Office bearers', rows: FLAMES_CREW.map((m) => rowFromRoster(m, null)) };
    const g = FLAMES_ROSTER.find((gr) => slug(shortWard(gr.ward)) === key);
    return g ? { label: `${shortWard(g.ward)} Ward`, rows: g.members.map((m) => rowFromRoster(m, shortWard(g.ward))) } : null;
  };
  const selWarembo = panePrefix === 'warembo' ? waremboRows(paneKey) : null;
  const selFlames = panePrefix === 'flames' ? flamesRows(paneKey) : null;

  // Index — one table per group. The SAME ward order is used across all three so
  // each ward lines up on the same row horizontally. Aspirant / Office bearers are
  // the first row of each table automatically.
  const WARD_ROW_ORDER = ['Frere Town', 'Kadzandani', 'Kongowea', 'Mkomani', "Ziwa La Ng'ombe"];
  const teamByWard = new Map(wardBuckets.map((b) => [b.name, b.rows.length]));
  const waremboByWard = new Map(WAREMBO_ROSTER.map((g) => [shortWard(g.ward), g.members.length]));
  const flamesByWard = new Map(FLAMES_ROSTER.map((g) => [shortWard(g.ward), g.members.length]));
  // Ward buttons (chips) — one per ward. Aspirant / Office bearers are NOT buttons;
  // they are listed inline in each bar.
  const teamWardChips = [
    ...WARD_ROW_ORDER.filter((w) => teamByWard.has(w)).map((w) => ({ label: w, n: teamByWard.get(w) ?? 0, href: `/team?group=members&pane=${slug(w)}` })),
    ...(leftover.length > 0 ? [{ label: 'No ward', n: leftover.length, href: '/team?group=members&pane=none' }] : []),
  ];
  const waremboWardChips = WARD_ROW_ORDER.map((w) => ({ label: w, n: waremboByWard.get(w) ?? 0, href: `/team?group=members&pane=warembo-${slug(w)}` }));
  const flamesWardChips = WARD_ROW_ORDER.map((w) => ({ label: w, n: flamesByWard.get(w) ?? 0, href: `/team?group=members&pane=flames-${slug(w)}` }));
  // Default lists shown inline (not behind a button).
  const aspirantRows = alfayo ? [rowFromPerson(alfayo, true)] : [];
  const waremboOfficeRows = warembo.map((p) => rowFromPerson(p, true));
  const flamesOfficeRows = FLAMES_CREW.map((m) => rowFromRoster(m, null));

  const waremboTotal = warembo.length + WAREMBO_ROSTER_COUNT;
  const flamesTotal = FLAMES_CREW.length + FLAMES_ROSTER_COUNT;
  const flamesBreakdown = FLAMES_ROSTER.map((g) => ({ ward: shortWard(g.ward), count: g.members.length }));

  const TABS: { key: Group; label: string; href: string }[] = [
    { key: 'all', label: 'Everyone', href: '/team' },
    { key: 'members', label: 'Members list', href: '/team?group=members' },
    { key: 'executive', label: 'Executive', href: '/team?group=executive' },
    { key: 'wards', label: 'All Wards', href: '/team?group=wards' },
    { key: 'warembo', label: 'Warembo', href: '/team?group=warembo' },
    { key: 'flames', label: 'Alfayo Flames', href: '/team?group=flames' },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-brand-textActive">Team Directory</h1>
        <p className="text-sm text-brand-textMuted">
          Alfayo Nelson Hope Foundation campaign organisation. {data.peopleRows.length} active members.
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

        {/* Single-entry add — complements bulk /data-import. Privileged roles only. */}
        {canAddMembers && (
          <div className="pt-1">
            <AddMemberForm wards={wardList} />
          </div>
        )}
      </header>

      {/* 📇 MEMBERS — three big bars (Ward team / Warembo / Flames), then pages. */}
      {showMembers && (
        <div className="space-y-6">
          {/* Index — three big bars: number + ward buttons; Aspirant / Office bearers listed inline. */}
          {pane === '' && (
            <div className="space-y-5">
              <GroupBar big={totalTeam} unit="active members" accent="#B4530A" wardChips={teamWardChips} defaultLabel="Aspirant" defaultRows={aspirantRows} defaultHref="/team?group=members&pane=aspirant" />
              <GroupBar big={waremboTotal} unit="Warembo" accent="#DB2777" wardChips={waremboWardChips} defaultLabel="Office bearers" defaultRows={waremboOfficeRows} defaultHref="/team?group=members&pane=warembo-office" />
              <GroupBar big={flamesTotal} unit="Alfayo Flames crew" accent="#7C3AED" wardChips={flamesWardChips} defaultLabel="Office bearers" defaultRows={flamesOfficeRows} defaultHref="/team?group=members&pane=flames-office" />
            </div>
          )}

          {/* A specific page — with a clear way back to the bars. */}
          {pane !== '' && (
            <Link href="/team?group=members" className="inline-flex items-center gap-2 min-h-[40px] rounded-lg border border-brand-borderStrong bg-brand-cardBg px-3 py-2 text-sm font-semibold text-brand-textActive shadow-sm hover:border-brand-burnt hover:text-brand-burnt transition">
              <span className="text-base">←</span> Back to team overview
            </Link>
          )}

          {/* Aspirant page */}
          {pane === 'aspirant' && alfayo && (
            <section className="space-y-2">
              <h3 className="text-lg font-extrabold text-brand-textActive">Aspirant</h3>
              <div className="rounded-2xl border-2 overflow-hidden" style={{ backgroundColor: '#FFF4E9', borderColor: '#F3C79B' }}>
                <MemberRow n={1} r={rowFromPerson(alfayo, true)} />
              </div>
            </section>
          )}

          {/* Single ward page */}
          {selectedWard && (
            <MemberGroup title={`${selectedWard.name} Ward`} count={selectedWard.rows.length} tint={wardTint(selectedWard.name)}>
              {selectedWard.rows.map((r, i) => <MemberRow key={`${r.key}:${i}`} n={i + 1} r={r} />)}
            </MemberGroup>
          )}

          {/* No-home-ward page */}
          {pane === 'none' && leftover.length > 0 && (
            <MemberGroup title="No home ward" count={leftover.length}>
              {leftover.map((r, i) => <MemberRow key={`${r.key}:${i}`} n={i + 1} r={r} />)}
            </MemberGroup>
          )}

          {/* Warembo — a single ward's page */}
          {selWarembo && (
            <MemberGroup title={`Warembo · ${selWarembo.label}`} count={selWarembo.rows.length} tint={{ bg: '#FBE9F1', border: '#F1C6DC' }}>
              {selWarembo.rows.map((r, i) => <MemberRow key={`${r.key}:${i}`} n={i + 1} r={r} />)}
            </MemberGroup>
          )}

          {/* Flames — a single ward's page */}
          {selFlames && (
            <MemberGroup title={`Alfayo Flames · ${selFlames.label}`} count={selFlames.rows.length} tint={{ bg: '#F1EAFB', border: '#D9C7F2' }}>
              {selFlames.rows.map((r, i) => <MemberRow key={`${r.key}:${i}`} n={i + 1} r={r} />)}
            </MemberGroup>
          )}
        </div>
      )}

      {/* 🛠 EXECUTIVE TEAM */}
      {showExec && executive.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Executive Team" count={`${executive.length} members`} />
          <CardGrid>
            {executive.map((p) => (
              <PersonCard
                key={p.id}
                p={p}
                memberIdOverride={memberIdOf(p)}
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
                memberIdOverride={memberIdOf(p)}
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
            // Execs explicitly dual-assigned to this ward (e.g. Arnold Baya → Kadzandani)
            // belong in the Assistant Ward Rep slot, not buried under "other members".
            const dualAsstNames = new Set(
              Object.entries(DUAL_WARD_ASSIGNMENTS)
                .filter(([, dwId]) => dwId === wId)
                .map(([name]) => name),
            );
            const wardAssistants = members.filter(
              (m) => m.role === 'assistant_ward_coordinator' || dualAsstNames.has(m.fullName),
            );
            // Execs / Warembo / other members whose home ward is this one.
            const otherMembers = members.filter(
              (m) => !isWardRole(m.role) && !dualAsstNames.has(m.fullName),
            );
            const wardTeam = WARD_TEAM_BY_NAME[wName];
            const wardTeamMembers = (wardTeam?.members ?? []).map((m) => {
              const r = registry.resolve(m.name, m.phone, m.id);
              const hit = pollingFor(m.id, m.phone, m.name);
              return {
                ...m,
                memberId: r?.memberId ?? '—',
                agentId: r?.agentId ?? '—',
                photoSrc: r?.photoSrc ?? null,
                station: hit?.station ?? null,
                stationCode: hit?.code ?? null,
                votesWard: hit?.ward ?? null,
              };
            });
            return (
              <div key={wId} className="rounded-2xl border border-brand-border bg-brand-cardBg/50 p-4 space-y-4">
                {/* Leaders only by default; the button below reveals the whole list. */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-baseline gap-1.5 rounded-xl bg-brand-teal/10 border-2 border-brand-teal/40 px-3 py-1.5">
                      <span className="text-2xl font-extrabold text-brand-teal tabular-nums leading-none">
                        {(inCharge ? 1 : 0) + wardAssistants.length + (wardTeam?.members.length ?? 0) + otherMembers.length}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal">members</span>
                    </span>
                    <h3 className="text-lg font-extrabold text-brand-textActive">{wName} Ward</h3>
                  </div>
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
                      memberIdOverride={memberIdOf(inCharge)}
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
                      memberIdOverride={memberIdOf(a)}
                      wardName={wName}
                      isSuperUser={SUPER_USER_NAMES.has(a.fullName)}
                      operationalBase={null}
                      forceLabel="Assistant Ward Representative"
                    />
                  ))}
                </CardGrid>

                {/* One button to reveal the WHOLE member list (field team + others). */}
                {(wardTeam || otherMembers.length > 0) && (
                  <details className="group">
                    <summary className="cursor-pointer list-none inline-flex items-center gap-2 rounded-full border border-brand-burnt/50 bg-brand-burnt/10 px-4 py-1.5 text-xs font-bold text-brand-burnt hover:bg-brand-burnt/20 transition select-none">
                      <span className="group-open:hidden">
                        ▸ See all {wName} members ({(wardTeam?.members.length ?? 0) + otherMembers.length})
                      </span>
                      <span className="hidden group-open:inline">▾ Hide {wName} members</span>
                    </summary>

                    <div className="mt-3 space-y-4">
                      {/* Field-team roster — tap any name for their Member & Agent ID card. */}
                      {wardTeam && (
                        <div className="rounded-xl border border-brand-border/60 bg-brand-cardBgHeavy/40 p-3">
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-textMuted">
                            Field Team — tap any name for their Member &amp; Agent ID card
                          </div>
                          <WardTeamRoster ward={wName} members={wardTeamMembers} />
                        </div>
                      )}

                      {/* Other DB members whose home ward is this one. */}
                      {otherMembers.length > 0 && (
                        <div>
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-textMuted">
                            Other members
                          </div>
                          <CardGrid>
                            {otherMembers.map((a) => (
                              <PersonCard
                                key={a.id + ':' + wId}
                                p={a}
                                memberIdOverride={memberIdOf(a)}
                                wardName={wName}
                                isSuperUser={SUPER_USER_NAMES.has(a.fullName)}
                                operationalBase={null}
                                dualRole
                              />
                            ))}
                          </CardGrid>
                        </div>
                      )}
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
          <SectionHeader
            title="Warembo wa Alfayo"
            count={`${warembo.length} office bearers · ${WAREMBO_ROSTER_COUNT} members`}
          />

          {/* 🌸 Petals of Alfayo — identity badge + modest per-ward breakdown.
              Sits above the office bearers so the ward strength reads at a glance. */}
          <div className="rounded-xl border border-pink-300/25 bg-gradient-to-br from-pink-500/[0.06] via-transparent to-transparent p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/15 border border-pink-400/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-pink-300">
                🌸 Petals of Alfayo
              </span>
              <span className="text-xs text-brand-textMuted">
                <span className="font-bold text-brand-gold">{WAREMBO_ROSTER_COUNT}</span> warembo across{' '}
                <span className="font-bold text-brand-gold">{WAREMBO_WARD_BREAKDOWN.length}</span> wards
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {WAREMBO_WARD_BREAKDOWN.map((b) => (
                <div
                  key={b.ward}
                  className="rounded-lg border border-brand-border bg-brand-cardBg/60 px-3 py-2 text-center"
                >
                  <div className="text-xl font-extrabold leading-none text-brand-gold">{b.count}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-brand-textMuted truncate" title={b.ward}>
                    {b.ward}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {warembo.length > 0 && (
            <CardGrid>
              {warembo.map((p) => (
                <PersonCard
                  key={p.id}
                  p={p}
                  memberIdOverride={memberIdOf(p)}
                  wardName={p.wardId ? data.wardName.get(p.wardId) ?? null : null}
                  isSuperUser={SUPER_USER_NAMES.has(p.fullName)}
                  operationalBase={OPERATIONAL_BASE[p.fullName]}
                  titleOverride={WAREMBO_TITLES[p.fullName]}
                />
              ))}
            </CardGrid>
          )}

          {/* Full registration roster — bulk membership behind a disclosure, grouped by ward. */}
          <details className="group">
            <summary className="cursor-pointer list-none inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-cardBg px-4 py-1.5 text-xs font-bold text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt transition select-none">
              <span className="group-open:hidden">▸ See other members ({WAREMBO_ROSTER_COUNT})</span>
              <span className="hidden group-open:inline">▾ Hide other members</span>
            </summary>
            <WaremboRoster groups={waremboGroups} />
          </details>
        </section>
      )}

      {/* 🔥 ALFAYO FLAMES */}
      {showFlames && (
        <section className="space-y-4">
          <SectionHeader title="Alfayo Flames" count={`${FLAMES_CREW.length} leadership · ${FLAMES_ROSTER_COUNT} ward crew`} />
          <div className="rounded-xl border border-brand-rust/30 bg-gradient-to-br from-brand-rust/[0.07] via-transparent to-transparent p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-rust/15 border border-brand-rust/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-rust">
                🔥 Alfayo Flames Crew
              </span>
              <span className="text-xs text-brand-textMuted">
                Leadership &amp; in-charge · tap any name for their Member &amp; Agent ID card
              </span>
            </div>
            <FlamesCrew members={flamesMembers} />

            {/* Rank-and-file ward crew behind a disclosure, grouped by ward. */}
            <details className="group">
              <summary className="cursor-pointer list-none inline-flex items-center gap-2 rounded-full border border-brand-rust/30 bg-brand-cardBg px-4 py-1.5 text-xs font-bold text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt transition select-none">
                <span className="group-open:hidden">▸ See ward crew ({FLAMES_ROSTER_COUNT})</span>
                <span className="hidden group-open:inline">▾ Hide ward crew</span>
              </summary>
              <FlamesRoster groups={flamesGroups} />
            </details>

            <p className="text-[11px] text-brand-textMuted italic">
              Leadership above; ward crew grouped by ward below. IEBC voter cross-match (registered-voter
              badges + polling stations) is on the{' '}
              <Link href="/flames" className="text-brand-rust hover:underline">Flames page</Link>.
            </p>
          </div>
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

// A clickable number cell in the summary table.
function TableNum({ n, href }: { n?: number; href: string }) {
  if (!n) return <span className="text-brand-textMuted">—</span>;
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 font-extrabold tabular-nums text-brand-burnt hover:underline">
      {n}<span className="text-xs">›</span>
    </Link>
  );
}

// One group's big bar: big total number + ward buttons on top; the default list
// (Aspirant / Office bearers) is shown inline below — not behind a button.
function GroupBar({
  big, unit, accent, wardChips, defaultLabel, defaultRows, defaultHref,
}: {
  big: number;
  unit: string;
  accent: string;
  wardChips: { label: string; n: number; href: string }[];
  defaultLabel: string;
  defaultRows: MemberRowData[];
  defaultHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-cardBg overflow-hidden">
      {/* Header: big number + chips. The leading accent chip is the default group
          (Aspirant / Office bearers); with it, all chips add up to the big number. */}
      <div className="p-5 flex items-center gap-5 flex-wrap border-b border-brand-border">
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-6xl font-extrabold tabular-nums leading-none" style={{ color: accent }}>{big}</span>
          <span className="text-sm font-bold uppercase tracking-wide text-brand-textActive leading-tight max-w-[7rem]">{unit}</span>
        </div>
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {defaultRows.length > 0 && (
            <CountChip label={defaultLabel} n={defaultRows.length} href={defaultHref} accentColor={accent} />
          )}
          {wardChips.map((r) => <CountChip key={r.label} label={r.label} n={r.n} href={r.href} />)}
        </div>
      </div>
      {/* Default list — listed inline */}
      {defaultRows.length > 0 && (
        <div>
          <div className="px-5 py-2.5 bg-brand-cardBgHeavy/40 border-b border-brand-border flex items-baseline justify-between gap-2">
            <span className="text-sm font-extrabold uppercase tracking-wider text-brand-textActive">{defaultLabel}</span>
            <span className="inline-flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-brand-burnt tabular-nums leading-none">{defaultRows.length}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">listed</span>
            </span>
          </div>
          <div className="divide-y divide-black/5">
            {defaultRows.map((r, i) => <MemberRow key={`${r.key}:${i}`} n={i + 1} r={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Members-list group + row (compact, big, expandable) ─────────────────────
function CountChip({ label, n, href, active, accentColor }: { label: string; n: number; href?: string; active?: boolean; accentColor?: string }) {
  // accentColor renders a filled chip in the group's accent (used for the leading
  // "category" chip — Aspirant / Office bearers — so every big number equals the
  // visible sum of its chips).
  const filled = active || !!accentColor;
  const base = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 transition select-none';
  const filledStyle = accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined;
  const inner = (
    <>
      <span className={`text-lg font-extrabold tabular-nums leading-none ${filled ? 'text-white' : 'text-brand-textActive'}`}>{n}</span>
      <span className={`text-xs font-semibold ${filled ? 'text-white/90' : 'text-brand-textBody'}`}>{label}</span>
      {href && <span className={`ml-0.5 text-sm font-bold leading-none ${filled ? 'text-white/80' : 'text-brand-burnt'}`}>›</span>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        style={filledStyle}
        className={`${base} cursor-pointer shadow-sm active:scale-[0.97] ${accentColor ? 'hover:opacity-90 hover:shadow' : active ? 'bg-brand-burnt border-brand-burnt' : 'bg-brand-cardBg border-brand-borderStrong hover:border-brand-burnt hover:bg-brand-burnt/10 hover:shadow'}`}
      >
        {inner}
      </Link>
    );
  }
  return <span style={filledStyle} className={`${base} ${accentColor ? '' : 'bg-brand-cardBgHeavy/50 border-brand-border'}`}>{inner}</span>;
}

function MemberGroup({
  title, count, breakdown, tint, id, children,
}: {
  title: string;
  count: number;
  breakdown?: { ward: string; count: number }[];
  tint?: { bg: string; border: string };
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-2 scroll-mt-28">
      <div className="border-b-2 border-brand-burnt/30 pb-2 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xl font-extrabold text-brand-textActive">{title}</h3>
          <span className="shrink-0 inline-flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-brand-burnt tabular-nums leading-none">{count}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-burnt">members</span>
          </span>
        </div>
        {breakdown && breakdown.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {breakdown.map((b) => <CountChip key={b.ward} label={b.ward} n={b.count} />)}
          </div>
        )}
      </div>
      <div
        className={`rounded-2xl border overflow-hidden divide-y ${tint ? 'divide-black/5' : 'border-brand-border bg-brand-cardBg divide-brand-border/60'}`}
        style={tint ? { backgroundColor: tint.bg, borderColor: tint.border } : undefined}
      >
        {children}
      </div>
    </section>
  );
}

// A colour-tinted sub-block (a ward, or "Office bearers") inside a TeamBox.
function SubBlock({
  title, count, tint, id, children,
}: {
  title: string;
  count: number;
  tint: { bg: string; border: string };
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="rounded-xl border overflow-hidden scroll-mt-28" style={{ backgroundColor: tint.bg, borderColor: tint.border }}>
      <div className="flex items-baseline justify-between gap-2 px-3 py-2 border-b" style={{ borderColor: tint.border }}>
        <span className="text-base font-extrabold text-brand-textActive">{title}</span>
        <span className="inline-flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-brand-textActive tabular-nums leading-none">{count}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">members</span>
        </span>
      </div>
      <div className="divide-y divide-black/5">{children}</div>
    </div>
  );
}

// Outer coloured box for Warembo (pink) / Flames (purple), holding per-ward sub-blocks.
function TeamBox({
  title, total, breakdown, boxTint, anchorPrefix, id, children,
}: {
  title: string;
  total: number;
  breakdown?: { ward: string; count: number }[];
  boxTint: { bg: string; border: string };
  anchorPrefix?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border p-4 space-y-3 scroll-mt-28" style={{ backgroundColor: boxTint.bg, borderColor: boxTint.border }}>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-2xl font-extrabold text-brand-textActive">{title}</h3>
          <span className="shrink-0 inline-flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-brand-textActive tabular-nums leading-none">{total}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-textMuted">members</span>
          </span>
        </div>
        {breakdown && breakdown.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {breakdown.map((b) => (
              <CountChip key={b.ward} label={b.ward} n={b.count} href={anchorPrefix ? `#${anchorPrefix}-${slug(b.ward)}` : undefined} />
            ))}
          </div>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function MemberRow({ r, n }: { r: MemberRowData; n?: number }) {
  const initials = r.name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return (
    <details className="group">
      <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-black/5 list-none">
        {typeof n === 'number' && (
          <span className="w-7 shrink-0 text-right text-base font-extrabold text-brand-textMuted tabular-nums">{n}.</span>
        )}
        {r.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photo} alt="" className="w-12 h-12 rounded-full object-cover border border-brand-border shrink-0" />
        ) : (
          <span className="w-12 h-12 rounded-full bg-brand-teal/15 text-brand-teal flex items-center justify-center text-sm font-bold shrink-0">{initials}</span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-base font-bold text-brand-textActive truncate">
            {r.name}
          </span>
          <span className="block text-xs text-brand-textMuted truncate">{r.subtitle}{r.ward ? ` · ${r.ward}` : ''}</span>
        </span>
        {r.memberId && (
          <span className="shrink-0 rounded-md bg-brand-burnt/10 border border-brand-burnt/30 px-2.5 py-1 text-xs font-mono font-bold text-brand-burnt">{r.memberId}</span>
        )}
        <svg className="w-5 h-5 text-brand-textMuted transition-transform group-open:rotate-180 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-4 pb-4 pl-[4.5rem] text-sm text-brand-textBody">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          <div><span className="text-brand-textMuted">Member ID:</span> <span className="font-mono font-bold text-brand-textActive">{r.memberId ?? '—'}</span></div>
          <div><span className="text-brand-textMuted">Role:</span> {r.subtitle}</div>
          {r.ward && <div><span className="text-brand-textMuted">Ward:</span> {r.ward}</div>}
          <div><span className="text-brand-textMuted">National ID:</span> {r.nationalId ?? '—'}</div>
          {r.station && (
            <div className="sm:col-span-2"><span className="text-brand-textMuted">Votes at:</span> {r.station}{r.stationCode ? ` (${r.stationCode})` : ''}</div>
          )}
          {r.phone && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <span className="text-brand-textMuted">Phone:</span>
              <span className="font-mono">{r.phone}</span>
              <PhoneActions phone={r.phone} size="sm" />
            </div>
          )}
        </div>
        {r.profileHref && (
          <div className="pt-2">
            <Link href={r.profileHref} className="text-xs font-semibold text-brand-tealBlue hover:text-brand-burnt">View 360 profile →</Link>
          </div>
        )}
      </div>
    </details>
  );
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
  nationalId: string | null;
}

// Portal-style card: big circular photo, name + role centred beneath.
function PersonCard({
  p,
  wardName,
  operationalBase,
  highlight,
  forceLabel,
  titleOverride,
  dualRole,
  memberIdOverride,
}: {
  p: PersonRow;
  wardName: string | null;
  // Kept so existing call sites compile; Super Admin status is intentionally NOT
  // shown anywhere in the UI (no stars, no badge).
  isSuperUser?: boolean;
  operationalBase?: string | null;
  highlight?: boolean;
  forceLabel?: string;
  // Docket-specific title that wins over p.title — used so someone who holds
  // different posts in two dockets (e.g. Irene: Exec "Head of Planning" but
  // Warembo "Head of Media") shows the right title per section.
  titleOverride?: string;
  dualRole?: boolean;
  memberIdOverride?: string | null;
}) {
  const memberId = memberIdOverride ?? p.teamId;
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
          <div className="w-24 h-24 rounded-full border-2 bg-brand-teal/10 border-brand-teal/40 text-brand-teal flex items-center justify-center text-2xl font-bold">
            {initials}
          </div>
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

      {/* Member ID badge — canonical registry ID, clickable to the ID card */}
      {memberId && (
        <Link
          href={`/team/${p.id}`}
          className="mt-1 inline-block rounded-md bg-brand-burnt/15 border border-brand-burnt/30 px-2 py-0.5 text-[10px] font-black tracking-widest text-brand-burnt hover:bg-brand-burnt hover:text-white transition"
          title="View ID card"
        >
          {memberId}
        </Link>
      )}

      {/* Badges — Super Admin status is intentionally not shown. */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
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
