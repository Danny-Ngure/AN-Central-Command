// Seed Frere Town schools into community_sites.
//
//   node tools/seed-freretown-schools.cjs
//
// Idempotent: clears school_*/tertiary rows for Frere Town then re-inserts.
// Source: user-supplied list (no public/private label given). Classified by
// convention — "X Primary" / "Primary and Secondary" => public (government);
// academy / kindergarten / kids / tots / junior / Estate View => private.
// No contact details or coordinates in the source; rows default to the ward
// centroid. Village kept as area_name.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const FRERE_TOWN = '22222222-0000-4000-8000-000000000004';

// [name, type, village]
const SCHOOLS = [
  ['Jumbo Junior Academy', 'school_private', 'Mashauri'],
  // Khadija village
  ['Khadija Primary and Secondary', 'school_public', 'Khadija'],
  ['Bright Academy', 'school_private', 'Khadija'],
  ['Maryjoy Kindergarten', 'school_private', 'Khadija'],
  ['Skway Kids Academy', 'school_private', 'Khadija'],
  ['St Joseph Primary and Secondary', 'school_public', 'Khadija'],
  ['Tiny Toys Academy', 'school_private', 'Khadija'],
  // Mlaleo village
  ['Kisauni Primary School', 'school_public', 'Mlaleo'],
  ['Brights Academy', 'school_private', 'Mlaleo'],
  ['Mlaleo Primary School', 'school_public', 'Mlaleo'],
  ['Beacon of Lights Academy', 'school_private', 'Mlaleo'],
  ['Maya Tots Academy', 'school_private', 'Mlaleo'],
  // Barsheba village
  ['Estate View School', 'school_private', 'Barsheba'],
];

async function main() {
  await sql`
    DELETE FROM community_sites
    WHERE ward_id = ${FRERE_TOWN}
      AND type IN ('school_public','school_private','school_tertiary')
  `;

  const centroid = sql`(SELECT centroid FROM wards WHERE id = ${FRERE_TOWN}::uuid)`;

  let n = 0;
  for (const [name, type, village] of SCHOOLS) {
    await sql`
      INSERT INTO community_sites (type, name, location, ward_id, area_name)
      VALUES (${type}, ${name}, ${centroid}, ${FRERE_TOWN}, ${village})
    `;
    n++;
  }

  const pub = SCHOOLS.filter((s) => s[1] === 'school_public').length;
  console.log(`✓ Frere Town schools: ${n}  (public ${pub}, private ${n - pub})`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
