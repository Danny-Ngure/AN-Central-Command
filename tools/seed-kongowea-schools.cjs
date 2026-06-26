// Seed Kongowea schools into community_sites.
//
//   node tools/seed-kongowea-schools.cjs
//
// Idempotent: clears school_*/tertiary rows for Kongowea then re-inserts.
// Source: user-supplied PDF "Private primary school.pdf" (Kongowea ward) — three
// tables: private primary (29), public primary (4), secondary (3). The secondary
// table carried no public/private label; classified school_secondary (public group).
// No contact details/coordinates except one director (The Rock — Md. Clara); rows
// default to the ward centroid. LOCATION column kept as area_name.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const KONGOWEA = '22222222-0000-4000-8000-000000000002';

// [name, type, location, director?]
const SCHOOLS = [
  // --- Private primary ---
  ['Precious Brown', 'school_private', 'Karama'],
  ['Qudria Primary', 'school_private', 'Karama'],
  ['Jocham Green Academy', 'school_private', 'Karama'],
  ['Jocham Blue Academy', 'school_private', 'Umoja'],
  ['Jocham Academy', 'school_private', 'Makutano'],
  ['Rahni Primary', 'school_private', 'Karama'],
  ['Edwin Bright Star', 'school_private', 'Uwanja wa Mbuzi'],
  ['Junior Learners', 'school_private', 'Kwa Chief'],
  ['Ketriz Academy', 'school_private', 'Kwa Chief'],
  ['Florist Academy', 'school_private', 'Kwa Chief'],
  ['Friends Academy', 'school_private', 'Mwamba'],
  ['Masaba Hills Academy', 'school_private', 'Soweto'],
  ['Nyali Little Souls', 'school_private', 'Harambee Estate'],
  ['The Brooks International', 'school_private', 'Harambee Estate'],
  ['The Rock', 'school_private', 'Kambi Kikuyu', 'Md. Clara'],
  ['Bee Bong Academy', 'school_private', 'Generation'],
  ['Blue Bell Academy', 'school_private', 'Karama'],
  ['Curtist Baptist Primary', 'school_private', 'Thauba'],
  ['Rose Star Junior', 'school_private', 'Thauba'],
  ['Daarul Quran Alislamy School', 'school_private', 'Thauba'],
  ['Church of God Academy', 'school_private', 'Makuti'],
  ['ACK Academy', 'school_private', 'Lights'],
  ['Precious Angel', 'school_private', 'Thauba'],
  ['Rocksan Academy', 'school_private', 'Kambi Kikuyu'],
  ['Day Spring', 'school_private', 'Makuti'],
  ['Mwangaza', 'school_private', 'Kambi Kikuyu'],
  ['Great Vision Academy', 'school_private', 'Maweni'],
  ['Leads Little Heart', 'school_private', 'Kongowea'],
  ['Olofa Academy', 'school_private', 'Kongowea'],
  // --- Public primary ---
  ['Kengeleni Primary', 'school_public', 'Kongowea'],
  ['Kongowea Primary', 'school_public', 'Kongowea'],
  ['Sineno Primary', 'school_public', 'Sineno'],
  ['Kangi Primary', 'school_public', 'Kangi'],
  // --- Secondary ---
  ['Azahari Secondary', 'school_secondary', 'Karama'],
  ['Kongowea Secondary', 'school_secondary', 'Kongowea'],
  ['St Francis High', 'school_secondary', 'Mwamba'],
];

async function main() {
  await sql`
    DELETE FROM community_sites
    WHERE ward_id = ${KONGOWEA}
      AND type IN ('school_public','school_private','school_tertiary','school_secondary','school_primary')
  `;

  const centroid = sql`(SELECT centroid FROM wards WHERE id = ${KONGOWEA}::uuid)`;

  let n = 0;
  for (const [name, type, location, director] of SCHOOLS) {
    await sql`
      INSERT INTO community_sites (type, name, location, ward_id, area_name, contact_person_name)
      VALUES (${type}, ${name}, ${centroid}, ${KONGOWEA}, ${location}, ${director ?? null})
    `;
    n++;
  }

  const pub = SCHOOLS.filter((s) => s[1] === 'school_public').length;
  const sec = SCHOOLS.filter((s) => s[1] === 'school_secondary').length;
  const priv = SCHOOLS.filter((s) => s[1] === 'school_private').length;
  console.log(`✓ Kongowea schools: ${n}  (private ${priv}, public primary ${pub}, secondary ${sec})`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
