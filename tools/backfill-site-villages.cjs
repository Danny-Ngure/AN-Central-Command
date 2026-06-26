// Trickle community sites down to villages: set community_sites.village_id from
// the site's free-text area_name, matched to a village in the same ward.
//
//   node tools/backfill-site-villages.cjs
//
// Match order (within ward): exact name == area_name → village name contained in
// area_name (longest wins) → area_name contained in village name (longest wins).
// Idempotent; re-run after new sites/villages. Sites with no confident match keep
// their existing village_id (ward-level only). Reports yield + leftovers.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

// Normalise for matching: lowercase, drop punctuation/apostrophes, strip a
// trailing "village"/"estate" descriptor, collapse spaces.
const norm = (s) => (s || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\b(village|estate)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const tight = (s) => norm(s).replace(/\s+/g, ''); // spaces removed too

async function main() {
  const villages = await sql`SELECT id, name, ward_id AS "wardId" FROM villages WHERE deleted_at IS NULL`;
  const byWard = new Map();
  for (const v of villages) {
    if (!byWard.has(v.wardId)) byWard.set(v.wardId, []);
    byWard.get(v.wardId).push({ ...v, n: norm(v.name), t: tight(v.name) });
  }

  const sites = await sql`
    SELECT id, area_name AS "areaName", ward_id AS "wardId"
    FROM community_sites
    WHERE deleted_at IS NULL AND area_name IS NOT NULL AND area_name <> ''
  `;

  let matched = 0;
  const leftovers = [];
  for (const s of sites) {
    const a = norm(s.areaName), at = tight(s.areaName);
    const vs = byWard.get(s.wardId) || [];
    const big = (str) => str.length >= 4; // avoid matching on tiny fragments
    let pick = vs.find((v) => v.n === a)                                    // exact (normalised)
      || vs.find((v) => v.t === at)                                        // exact (space/punct-stripped)
      || vs.filter((v) => big(v.t) && at.includes(v.t)).sort((x, y) => y.t.length - x.t.length)[0]  // village in area
      || vs.filter((v) => big(at) && v.t.includes(at)).sort((x, y) => x.t.length - y.t.length)[0];  // area in village
    if (!pick) { leftovers.push(s.areaName); continue; }
    await sql`UPDATE community_sites SET village_id = ${pick.id}, updated_at = now() WHERE id = ${s.id}`;
    matched++;
  }

  console.log(`✓ Linked ${matched}/${sites.length} sites (with an area) to a village.`);
  const uniqueLeft = [...new Set(leftovers.map((x) => x.trim()))].sort();
  if (uniqueLeft.length) {
    console.log(`  ${leftovers.length} sites had an area that matched no village — distinct area names left at ward level:`);
    console.log('   ' + uniqueLeft.join(', '));
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
