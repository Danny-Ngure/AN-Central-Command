// Promote genuine residential localities (that appear as site area labels but
// aren't in the villages list) into villages, so their sites trickle down too.
//
//   node tools/promote-localities-to-villages.cjs
//
// Ward is auto-detected from the sites carrying that area label (majority ward).
// Inserts with the ward centroid + null section (re-section later). Skips any that
// already exist in that ward. NOT run for bars/roads/institutions/landmarks.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

// Display name → matched by punctuation/space-stripped equality to site area.
const LOCALITIES = [
  'Soweto', 'Thauba', 'Makuti', 'Lights', 'Generation', 'Umoja', 'Makutano',
  'Mtopanga', 'Mkwajuni', 'Mteremko', 'Sineno', 'Mamba', 'Olienda', 'Sosiani',
  'Togo', 'Bite Bite', 'Bamburi Masters', 'Bamburi Mwaisho', 'Bullo Mudini',
  'Bakarani B', 'Kwa Chief', 'Kwa Bullo', 'Kwa Rasta', 'Harambee Estate',
  'Kaydee Swamp', 'Mtaa wa Kadiria', 'Mwamba',
];
const tight = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  let added = 0;
  const skipped = [];
  for (const name of LOCALITIES) {
    const t = tight(name);
    const wardRows = await sql`
      SELECT ward_id AS "wardId", count(*)::int AS c
      FROM community_sites
      WHERE deleted_at IS NULL AND regexp_replace(lower(area_name), '[^a-z0-9]', '', 'g') = ${t}
      GROUP BY ward_id ORDER BY c DESC LIMIT 1
    `;
    if (wardRows.length === 0) { skipped.push(`${name} (no sites)`); continue; }
    const wardId = wardRows[0].wardId;
    const exists = await sql`
      SELECT 1 FROM villages WHERE ward_id = ${wardId}
        AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = ${t} AND deleted_at IS NULL LIMIT 1
    `;
    if (exists.length > 0) { skipped.push(`${name} (already a village)`); continue; }
    await sql`
      INSERT INTO villages (ward_id, name, centroid)
      VALUES (${wardId}, ${name}, (SELECT centroid FROM wards WHERE id = ${wardId}::uuid))
    `;
    added++;
  }
  console.log(`✓ Added ${added} localities as villages.`);
  if (skipped.length) console.log('  Skipped: ' + skipped.join(', '));
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
