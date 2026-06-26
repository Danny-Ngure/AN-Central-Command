// Seed the documented Nyali-constituency roads, profiled from public sources
// (KeNHA, KURA, Mombasa County). Idempotent: clears previously-seeded rows
// (notes marked [seeded]) then re-inserts. Hand-entered MP/NG-CDF roads are NOT
// touched. Each row cites its source in notes. Ward-null roads are trunk/cross-
// ward and show in every ward's Roads tab as "constituency-wide".
//
//   node tools/seed-nyali-roads.cjs

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const ROADS = [
  {
    name: 'Mombasa–Malindi Road (A7 Highway)', ward: null, status: 'operational',
    funding: 'national', surface: 'tarmac', lengthKm: null, mp: false, agency: 'KeNHA',
    note: 'National trunk road. Enters Nyali at Nyali Bridge and runs north through Kengeleni, Nyali and Bamburi toward Mtwapa; part of the Mombasa–Malindi (A7) coastal corridor.',
    src: 'https://www.kenyanews.go.ke/dualling-of-nyali-mtwapa-bridge-road-on-course/',
  },
  {
    name: 'Nyali Bridge–Mtwapa Dual Carriageway', ward: "Ziwa La Ng'ombe", status: 'ongoing',
    funding: 'national', surface: 'tarmac', lengthKm: 13.5, mp: false, agency: 'KeNHA',
    note: '13.5 km dualling from Nyali Bridge to Mtwapa Bridge plus 12 km trunk drainage; reported ~90% complete in 2025/26. Runs through the northern wards (Ziwa la Ng’ombe / Shanzu).',
    src: 'https://www.kenyans.co.ke/news/112960-mombasa-mtwapa-dual-carriageway-90-complete-govt-spokesperson-mwaura',
  },
  {
    name: 'Links Road (Nyali)', ward: 'Mkomani', status: 'ongoing',
    funding: 'national', surface: 'tarmac', lengthKm: null, mp: false, agency: 'KURA',
    note: 'KURA upgrade and drainage of the flood-prone Nyali corridor; a 230 m section was closed Aug 2025–Jan 2026, with ~Sh64M routine maintenance reported.',
    src: 'https://www.the-star.co.ke/news/2025-07-22-kura-announces-6-month-closure-of-links-road-nyali',
  },
  {
    name: 'Kona Mbaya Road (to cabro standard)', ward: null, status: 'proposed',
    funding: 'county', surface: 'cabro', lengthKm: null, mp: false, agency: 'Mombasa County',
    note: 'Mombasa County tender (Dec 2025) to construct Kona Mbaya Road to cabro standard. Exact ward not yet confirmed.',
    src: 'https://tenderimpulse.com/government-tenders/kenya/construction-of-kona-mbaya-road-to-cabro-standards-10675285',
  },
];

async function main() {
  const wardRows = await sql`SELECT id, name FROM wards`;
  const wardId = (name) => (name ? (wardRows.find((w) => w.name === name)?.id ?? null) : null);

  await sql`DELETE FROM roads WHERE notes LIKE '%[seeded]%'`;

  let n = 0;
  for (const r of ROADS) {
    const notes = `${r.agency}. ${r.note} Source: ${r.src} [seeded]`;
    await sql`
      INSERT INTO roads (ward_id, name, status, funding, surface, length_km, mp_project, notes)
      VALUES (${wardId(r.ward)}, ${r.name}, ${r.status}, ${r.funding}, ${r.surface}, ${r.lengthKm}, ${r.mp}, ${notes})
    `;
    n++;
  }
  console.log(`✓ Seeded ${n} documented Nyali roads (KeNHA / KURA / County). Hand-entered MP/NG-CDF roads untouched.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
