// Seed Nyali polling CENTRES into polling_stations — RECONCILING seed.
//
//   node tools/seed-nyali-polling-centres.cjs
//
// For each of Nyali's 5 wards this matches the real IEBC 2022 centres to the
// stations already in the DB *by normalised name*, so voter links are preserved:
//   • name match  -> UPDATE registered_voters (keep the row id + its code); voters stay linked
//   • no match    -> INSERT the missing centre (code NYL-<ward>-<nn>)
//   • DB-only left -> DELETE (synthetic leftovers, e.g. 'Bombolulu Estate'); their
//                     voters.polling_station_id is set null by the FK, not orphaned in error.
// Idempotent: re-running matches by name and changes nothing further.
//
// registered_voters = sum of that centre's IEBC streams. Per-stream detail lives in
// apps/web/data/nyali-polling-streams.ts (shown on the station page's Streams tab).
// CODES 'NYL-*' are PROVISIONAL internal keys, not official IEBC/KIEMS codes.
//
// Source: IEBC 2022 Register of Voters; per-station via kenyayote.co.ke; centres
// cross-checked with blog.afro.co.ke/polling-stations/mombasa/nyali.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// ward -> [ [iebcCode, name, registeredVoters], ... ]
const WARDS = [
  { name: 'Frere Town', wardId: '22222222-0000-4000-8000-000000000004', centres: [
    ['NYL-FT-01', 'Frere Town Primary School', 6283],
    ['NYL-FT-02', 'Freretown Secondary School', 1345],
    ['NYL-FT-03', 'Khadija Primary School', 5199],
    ['NYL-FT-04', 'Fadhil-Adhym Primary School', 1835],
    ['NYL-FT-05', 'Teman Junior Academy', 610],
    ['NYL-FT-06', 'Sarajevo Grounds', 3021],
    ['NYL-FT-07', 'Victoria Baptist Primary School', 1759],
    ['NYL-FT-08', 'Mlaleo Primary School', 2826],
    ['NYL-FT-09', 'Mwandoni Kadiria Grounds', 1604],
    ['NYL-FT-10', 'Khadija Secondary School', 977],
  ] },
  { name: 'Ziwa La Ng\'ombe', wardId: '22222222-0000-4000-8000-000000000005', centres: [
    ['NYL-ZLN-01', 'Ziwa La Ng\'ombe Primary School', 9516],
    ['NYL-ZLN-02', 'KICODEP Hall', 1629],
    ['NYL-ZLN-03', 'Azhar Primary School', 472],
  ] },
  { name: 'Mkomani', wardId: '22222222-0000-4000-8000-000000000003', centres: [
    ['NYL-MKM-01', 'Mkomani Grounds', 2748],
    ['NYL-MKM-02', 'Maweni Primary School', 6675],
    ['NYL-MKM-03', 'Maweni Mixed Secondary School', 2588],
    ['NYL-MKM-04', 'ASK Ground - Gate \'A\'', 5088],
  ] },
  { name: 'Kongowea', wardId: '22222222-0000-4000-8000-000000000002', centres: [
    ['NYL-KNG-01', 'Kengeleni Primary School', 3465],
    ['NYL-KNG-02', 'Kwa Karama Grounds', 7386],
    ['NYL-KNG-03', 'Kongowea Primary School', 8007],
    ['NYL-KNG-04', 'Municipal Social Hall - Kongowea', 3932],
    ['NYL-KNG-05', 'Methodist Church - Kongowea', 5018],
    ['NYL-KNG-06', 'Kongowea Secondary School', 1038],
  ] },
  { name: 'Kadzandani', wardId: '22222222-0000-4000-8000-000000000001', centres: [
    ['NYL-KDZ-01', 'Bashir Primary School', 2633],
    ['NYL-KDZ-02', 'Mwatamba Grounds', 3759],
    ['NYL-KDZ-03', 'Kadzandani Primary School', 3715],
    ['NYL-KDZ-04', 'Teman Junior Academy', 610],
    ['NYL-KDZ-05', 'Soweto Grounds', 2810],
    ['NYL-KDZ-06', 'Marianist Polytechnic', 1670],
    ['NYL-KDZ-07', 'Bahawani Primary School', 2154],
  ] },
];

async function main() {
  let U = 0, I = 0, D = 0;
  for (const { name: wardName, wardId, centres } of WARDS) {
    const existing = await sql`SELECT id, name FROM polling_stations WHERE ward_id = ${wardId}`;
    const byNorm = new Map(existing.map((e) => [norm(e.name), e]));
    const keep = new Set();
    let u = 0, i = 0;
    const centroid = sql`(SELECT centroid FROM wards WHERE id = ${wardId}::uuid)`;
    for (const [code, cname, voters] of centres) {
      const match = byNorm.get(norm(cname));
      if (match) {
        await sql`UPDATE polling_stations
                    SET registered_voters = ${voters}, name = ${cname}, active = true
                  WHERE id = ${match.id}`;
        keep.add(match.id); u++; U++;
      } else {
        const [ins] = await sql`
          INSERT INTO polling_stations (ward_id, iebc_code, name, location, registered_voters)
          VALUES (${wardId}, ${code}, ${cname}, ${centroid}, ${voters})
          ON CONFLICT (iebc_code) DO UPDATE SET registered_voters = EXCLUDED.registered_voters,
            name = EXCLUDED.name, ward_id = EXCLUDED.ward_id, active = true
          RETURNING id`;
        keep.add(ins.id); i++; I++;
      }
    }
    const extras = existing.filter((e) => !keep.has(e.id));
    for (const e of extras) { await sql`DELETE FROM polling_stations WHERE id = ${e.id}`; D++; }
    console.log(`  ${wardName}: ${u} updated, ${i} inserted, ${extras.length} removed -> ${centres.length} centres`);
  }
  console.log(`\u2713 Nyali polling centres reconciled: ${U} updated, ${I} inserted, ${D} removed (target 30 centres, 100,372 voters).`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
