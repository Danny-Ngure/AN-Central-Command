// Seed Nyali CHURCHES into community_sites (type='church').
//
//   node tools/seed-nyali-churches.cjs
//
// Source: uploaded 'IEBC CHURCH REGISTERED VOTERS.xlsx' (Mombasa County, 90 churches).
// Only the 15 churches inside Nyali Constituency are seeded; the other 75 are EXCLUDED.
// Filtering: Google Plus-Code -> GPS -> point-in-polygon vs real Nyali ward boundaries;
// area-keyword fallback; one web-verified (Vineyard/Reef Hotel). Every church is placed
// in a ward AND a village. Idempotent: deletes prior row with same ward+name then inserts.
// location = exact GPS where a plus-code existed, else ward centroid. estimated_size =
// the church's register voter count (congregation reach).

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));
dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

// [wardId, name, village, phone, voters, lat, lng]
const CHURCHES = [
  ['22222222-0000-4000-8000-000000000005', 'Breakthrough Chapel International', 'Kidogo Basi', '0722659845', 1759, -4.03604, 39.69902],  // Ziwa La Ng'ombe
  ['22222222-0000-4000-8000-000000000005', 'St. Francis Of Assisi Catholic Church - Nyali', 'Timboni', '0724241754', 2168, -4.02621, 39.71305],  // Ziwa La Ng'ombe
  ['22222222-0000-4000-8000-000000000003', 'Vineyard Church Mombasa', 'Nyali', '0111 216216', 1965, null, null],  // Mkomani
  ['22222222-0000-4000-8000-000000000003', 'Prophetic embassy church of all nations', 'Mkomani', '0715 229169', 2069, null, null],  // Mkomani
  ['22222222-0000-4000-8000-000000000003', 'Nyali Baptist Church', 'Nyali', '0790 500005', 2485, null, null],  // Mkomani
  ['22222222-0000-4000-8000-000000000003', 'Christ Is The Answer Ministries (CITAM) Mombasa', 'Nyali', '+254 721 512704', 3514, -4.05594, 39.69969],  // Mkomani
  ['22222222-0000-4000-8000-000000000003', 'Nyali SDA church', 'Nyali', '0714 603932', 2587, null, null],  // Mkomani
  ['22222222-0000-4000-8000-000000000003', 'African Prophetic Church In Kenya', 'Nyali', '+254 722 311080', 3451, null, null],  // Mkomani
  ['22222222-0000-4000-8000-000000000003', 'Crossroads Fellowship, Nyali.', 'Sosiani', '0727 593663', 2480, -4.03996, 39.70473],  // Mkomani
  ['22222222-0000-4000-8000-000000000002', 'Inspiration Centre Deliverance Church International.', 'Kongowea', '0734 817840', 1254, null, null],  // Kongowea
  ['22222222-0000-4000-8000-000000000002', 'Nyali Fellowship', 'Karama', '+254 722 853412', 3321, -4.03846, 39.6977],  // Kongowea
  ['22222222-0000-4000-8000-000000000002', 'Elim Evangelistic P.E.F.A Church Kongowea', 'Karama', '+254 713 899777', 2658, null, null],  // Kongowea
  ['22222222-0000-4000-8000-000000000002', 'AIC Kongowea & Pwani Bible College', 'Masandukuni', '0748 957068', 1694, -4.03989, 39.6813],  // Kongowea
  ['22222222-0000-4000-8000-000000000001', 'CHRISTIAN CHURCH INTERNATIONAL-WORSHIP CENTRE', 'Bombolulu', '0799 220929', 2358, null, null],  // Kadzandani
  ['22222222-0000-4000-8000-000000000001', 'St. Martin de Pores Mbungoni, Marianist Church', 'Mwatamba Gorofani', '7256978458', 6350, -4.01939, 39.70092],  // Kadzandani
];

async function main() {
  let n = 0, placed = 0;
  for (const [wardId, name, village, phone, voters, lat, lng] of CHURCHES) {
    await sql`DELETE FROM community_sites WHERE type = 'church' AND ward_id = ${wardId} AND lower(name) = lower(${name})`;
    const location = (lat !== null && lng !== null)
      ? sql`ST_GeomFromText(${'POINT(' + lng + ' ' + lat + ')'}, 4326)`
      : sql`(SELECT centroid FROM wards WHERE id = ${wardId}::uuid)`;
    const [vrow] = village
      ? await sql`SELECT id FROM villages WHERE ward_id = ${wardId} AND lower(name) = lower(${village}) LIMIT 1`
      : [undefined];
    const villageId = vrow ? vrow.id : null;
    if (villageId) placed++;
    await sql`
      INSERT INTO community_sites (type, name, location, ward_id, village_id, area_name, contact_phone, contact_role, estimated_size)
      VALUES ('church', ${name}, ${location}, ${wardId}, ${villageId}, ${village || null}, ${phone || null}, 'Pastor', ${voters})
    `;
    n++;
  }
  console.log(`\u2713 Nyali churches seeded: ${n} (village FK matched for ${placed}/${n}).`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
