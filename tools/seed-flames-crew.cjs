// Seed the Alfayo Flames Crew roster and cross-match each member to the IEBC
// voter register.
//
//   node tools/seed-flames-crew.cjs
//
// Idempotent: UPSERTs by (ward_id, position). Re-running re-computes matches.
//
// Matching (per ward):
//   1. Exact E.164 phone match            -> match_method 'phone'
//   2. Unique exact-word name match        -> match_method 'name'
//   3. Otherwise unmatched (with a note explaining why).
//
// Name matching is deliberately high-precision (every supplied name token must
// equal a whole word in the voter's "SURNAME FIRSTNAME", and the match must be
// unique). Spelling variants / ambiguous hits are left unmatched and flagged so
// the campaign can reconcile them by hand rather than mis-embedding a voter.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Check apps/web/.env.local.');
  process.exit(1);
}
const sql = postgres(DATABASE_URL, { prepare: false });

const WARD = {
  FrereTown: '22222222-0000-4000-8000-000000000004',
  Kadzandani: '22222222-0000-4000-8000-000000000001',
  Kongowea: '22222222-0000-4000-8000-000000000002',
  Mkomani: '22222222-0000-4000-8000-000000000003',
  Ziwa: '22222222-0000-4000-8000-000000000005',
};

// ── The supplied roster (position, full name, raw phone string) ──────────────
const ROSTER = {
  Kadzandani: [
    'Judith Asienga | 0796697137',
    'Elizabeth Aloo | 0722772991',
    'Jane Okeyo | 0718689283',
    'Purity | 0727399341',
    'Tima Mohamed | 0711919277',
    'Ramla Hamadi | 0704849572',
    'Salma Odongo | 0745361334',
    'Rashida Abdalla | 0710123707',
    'Jamila Kimwinyi | 0729 753685',
    'Mishi Katana | 0741083929',
    'Winnie Mwambaru | 0792811602',
    'Josephine Mwenda | 0722660181',
  ],
  FrereTown: [
    'Edith A. Kienga | 0710251823',
    'Elizabeth Dama | 0715488749',
    'Winnie Meshack | 0790629109',
    'Pauline Adhiambo | 0700652904',
    'Jackline John | 0701932522',
    'Olivia Anyango | 0745833489',
    'Sharon Onyango | 0716686577',
    'Racheal Awuor | 0740347207',
    'Ann Macharia | 0713666899',
    'Phenistus Munania | 0716746365',
    'Jane Mwende | ',
    'Josphine Otieno | 0715890428',
    'Charleen Awuor | 0793535792',
    'Metrin Wanyama | 0740555824',
    'Lucy Odongo | 0113342960',
    'Seraphine Akello | 0746331980',
    'Zainabu Kalama | 0702148701',
    'Fatma Shee | 0706686518',
    'Mwanamkuu Abdalla | 0703246837',
    'Saumu Saidi | 0758439496',
    'Amina Kazungu | 0701386173',
    'Mary Katana | 0792866322',
    'Juliana | ',
    'Prisca Karisa | 0718702208',
    'Banistray Omondi | 0791958270',
    'Florence Dunell | 0704973881',
    'Mariam Omar | 0725573422',
    'Rukia Musa | 0741775194',
    'Lilian Adhiambo | 0790302609',
    'Ruth Kache | 0701795832',
    'Mapenzi Rachael | 0792681893',
    'Jane Mtawali | 0700317604',
    'Zawadi Williams | 0718841552',
    'Faith Mwikali | 0710115754',
    'Uba Mohammad | 0715803527',
  ],
  Ziwa: [
    'Everlyn Obuya | 0713687429',
    'Millicent Ochika | 0701591002',
    'Jackline Edira | 0790334432',
    'Hawaa Muhamed | 0762009945',
    'Mwanaisha Kaure | 0712449262',
    'Joan Rose | 0740786184',
    'Zeitun Masha | 0111635563',
    'Subira Iddi | 0712898686',
    'Asia Salim | 0111876269',
    'Idah Adhiambo | 0142290089',
    'Winnie Awuor | 0793940665',
    'Rose Ogongo | 0720720463',
    'Vivian Sen | 0114410621',
    'Zeddy Chepkoech | 0704328530',
    'Mariam Ali | 0704209899',
    'Mara Mghendi | 0712533268',
    'Zubedq Swaleh | 0795845170',
    'Margret Ochola | 0713304642',
    'Bipopo Masha | 0703147693',
    'Martina | 0701932614',
    'Mariam Issa | 0790633162',
    'Eunice Luka | 0717226610',
    'Mwanamkuu Abdalla | 0705201790',
    'Grace Makena | 0708227281',
    'Christine Njema | 0714226898',
    'Everline Nanda | 0723557958',
    'Molly Kitoto | 0715034070',
    'Caroline Awuor | 0727605066',
    'Caroline Msili | 0746332809',
    'Anna Kasendi | 0700193274',
  ],
  Mkomani: [
    'Purity Mukoko | 0706830976',
    'Lucy Agutu | 0750419496',
    'Susan Athiambo | 0754591090',
    'Fridah Akoth | 0703224617',
    'Neema Joseph | 0718621911',
    'Martha Shihemi | 0792842391',
    'Rose Ajema | 0795910045',
    'Jackline Dan | 0731662379',
    'Mary Atieno | 0745709939',
    'Fatuma Kulola | 0790574094',
    'Julian Akinyi | 0796463976',
    'Philgona Azwon | 0707707883',
    'Zawadi William | 0718841552',
    'Sofia Tukimia | 0743253184',
    'Grace Awuor | 0704017831',
    'Purity Rose | 0759840380',
    'Everline Ngoto | 070882006',
    'Dina Nahumicha | 0741644487',
    'Grace Musembi | 0743076232',
    'Lilian Muchewa | 0701342199',
    'Martha Chao | 0716152832',
    'Janet Akoth | 0751912740',
    'Winnie Achieng | 0716368744',
    'Irine Akinyi | 0114231028',
    'Jackline Oyie | 0790334432',
    'Fatuma Matano | 0111337644',
    'Maureen Akinyi | ',
    'Halima Musa | ',
    'Celestine Awino | 0768334793',
    'Joan Rose | 0740786184',
    'Mildred Akinyi | 0705566406',
    'Catherine Awino | ',
  ],
  Kongowea: [
    'Mercy Akinyi | 0708192632',
    'Lilian Nyakundi | 0701758881',
    'Eunice Nduko | 0717110616',
    'Rose Chimosi | 0725164144',
    'Ruth Ratemo | 0725532854',
    'Recho Mumbi | 0712951195',
    'Josphine Joel | 0712552114',
    'Gojine Nyagilo | 0790909866',
    'Joyce Onyancha | 0748405005',
    'Firdhaus Oloo | 0703224617',
    'Aisha Khamisi | 0758534393',
    'Aphline | 0799765384',
    'Florence Nyatwori | 0703490278',
    'Sara Okeyo | 074899853',
    'Jane Nganga | 0746997422',
    'Susan | 0714761881',
    'Grace | 0720282534',
    'Magret | 0702906385',
    'Moraa | 0746312899',
    'Everlyne Kerubo | 0792374550',
    'Zipporah Kwamboka | 0721119118',
    'Jackline Asiago | 0718685072',
    'Emily Dinga | 0719552001',
    'Eunine Kemunto | 0701543058',
    'Caro Mariango | 0741790377',
    'Ruth Moraa | 07255532854',
    'Angelina Ngira | 07255532853',
  ],
};

function normalizePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('254')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (/^[71]\d{8}$/.test(d)) return '+254' + d;
  return null;
}

function nameTokens(fullName) {
  return fullName
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3); // drops initials like "a."
}

async function main() {
  let totalInserted = 0;
  const summary = { phone: 0, name: 0, unmatched: 0, total: 0 };

  for (const [wardKey, members] of Object.entries(ROSTER)) {
    const wardId = WARD[wardKey];

    // Load every voter in this ward once for in-memory matching.
    const voterRows = await sql`
      SELECT id, surname, first_name, phone
      FROM voters
      WHERE ward_id = ${wardId}
    `;
    const phoneMap = new Map();
    const wordIndex = voterRows.map((v) => {
      if (v.phone) phoneMap.set(v.phone, v);
      const words = `${v.surname} ${v.first_name}`.toLowerCase().split(/\s+/).filter(Boolean);
      return { voter: v, words: new Set(words) };
    });

    for (let i = 0; i < members.length; i++) {
      const [namePart, phonePart] = members[i].split('|').map((s) => s.trim());
      const position = i + 1;
      const fullName = namePart;
      const rawPhone = phonePart || null;
      const phone = normalizePhone(rawPhone);
      const phoneTail = phone ? phone.slice(-4) : null;

      let voterId = null;
      let matchMethod = 'unmatched';
      let matchNote = null;

      // 1. Phone match
      if (phone && phoneMap.has(phone)) {
        voterId = phoneMap.get(phone).id;
        matchMethod = 'phone';
      } else {
        // 2. Unique exact-word name match
        const tokens = nameTokens(fullName);
        if (tokens.length >= 2) {
          const hits = wordIndex.filter((wi) => tokens.every((t) => wi.words.has(t)));
          if (hits.length === 1) {
            voterId = hits[0].voter.id;
            matchMethod = 'name';
          } else if (hits.length > 1) {
            matchNote = `${hits.length} possible name matches — needs manual pick`;
          } else {
            matchNote = 'no voter match by name';
          }
        } else {
          matchNote = 'single-name entry — no reliable match';
        }
        if (rawPhone && !phone) {
          matchNote = (matchNote ? matchNote + '; ' : '') + `unreadable phone "${rawPhone}"`;
        } else if (!rawPhone) {
          matchNote = (matchNote ? matchNote + '; ' : '') + 'no phone supplied';
        }
      }

      summary[matchMethod]++;
      summary.total++;

      await sql`
        INSERT INTO flames_crew
          (ward_id, position, full_name, raw_phone, phone, phone_tail, voter_id, match_method, match_note)
        VALUES
          (${wardId}, ${position}, ${fullName}, ${rawPhone}, ${phone}, ${phoneTail},
           ${voterId}, ${matchMethod}, ${matchNote})
        ON CONFLICT (ward_id, position) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          raw_phone = EXCLUDED.raw_phone,
          phone = EXCLUDED.phone,
          phone_tail = EXCLUDED.phone_tail,
          voter_id = EXCLUDED.voter_id,
          match_method = EXCLUDED.match_method,
          match_note = EXCLUDED.match_note,
          updated_at = now()
      `;
      totalInserted++;
    }
    console.log(`✓ ${wardKey}: ${members.length} crew members upserted`);
  }

  const matched = summary.phone + summary.name;
  console.log('\n── Cross-match summary ──────────────────────────');
  console.log(`  Total crew:        ${summary.total}`);
  console.log(`  Matched to voter:  ${matched}  (phone ${summary.phone}, name ${summary.name})`);
  console.log(`  Unmatched:         ${summary.unmatched}`);
  console.log(`  Match rate:        ${((matched / summary.total) * 100).toFixed(1)}%`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
