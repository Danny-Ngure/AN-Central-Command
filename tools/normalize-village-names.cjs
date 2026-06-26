// Tidy village names: Title-case the ALL-CAPS rows (legacy from site-area imports)
// and merge any that collide with an existing properly-cased village. FK references
// (sites, people, leaders, issues, roads) are reassigned to the kept row.
//
//   node tools/normalize-village-names.cjs   (then regenerate village boundaries)

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

// Near-duplicates whose normalised key differs from the canonical spelling.
const EXPLICIT = {
  'IDD KUMBI': 'Iddi Kumbi',
  'KIDOGOBASI': 'Kidogo Basi',
};
const SMALL = new Set(['ya', 'la', 'wa', 'na', 'of', 'the']);

function titleCase(name) {
  return name.toLowerCase().split(/\s+/).map((w, i) => {
    if (i > 0 && SMALL.has(w)) return w;
    if (/^[a-z](\.[a-z])+\.?$/.test(w)) return w.toUpperCase();   // acronym e.g. v.o.k
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

async function reassign(fromId, toId) {
  await sql`UPDATE community_sites   SET village_id      = ${toId} WHERE village_id      = ${fromId}`;
  await sql`UPDATE people            SET home_village_id = ${toId} WHERE home_village_id = ${fromId}`;
  await sql`UPDATE community_leaders SET village_id      = ${toId} WHERE village_id      = ${fromId}`;
  await sql`UPDATE village_issues    SET village_id      = ${toId} WHERE village_id      = ${fromId}`;
  await sql`UPDATE roads             SET from_village_id = ${toId} WHERE from_village_id = ${fromId}`;
  await sql`UPDATE roads             SET to_village_id   = ${toId} WHERE to_village_id   = ${fromId}`;
}

async function main() {
  const caps = await sql`
    SELECT id, name, ward_id AS "wardId" FROM villages
    WHERE deleted_at IS NULL AND name = upper(name) AND name ~ '[A-Z]'
    ORDER BY name`;

  let renamed = 0, merged = 0;
  for (const v of caps) {
    const newName = EXPLICIT[v.name] ?? titleCase(v.name);
    const canon = await sql`
      SELECT id FROM villages
      WHERE ward_id = ${v.wardId} AND name = ${newName} AND id <> ${v.id} AND deleted_at IS NULL
      LIMIT 1`;
    if (canon.length) {
      await reassign(v.id, canon[0].id);
      await sql`DELETE FROM villages WHERE id = ${v.id}`;
      merged++;
    } else {
      await sql`UPDATE villages SET name = ${newName}, updated_at = now() WHERE id = ${v.id}`;
      renamed++;
    }
  }

  console.log(`✓ Village names tidied: ${renamed} title-cased, ${merged} merged into existing rows.`);
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM villages WHERE deleted_at IS NULL`;
  console.log(`  Villages remaining: ${count}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
