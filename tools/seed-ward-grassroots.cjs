// Add ward grassroots team members (Ziwa La Ng'ombe + Kadzandani) from the
// user-supplied lists. Idempotent: upsert by normalised phone.
//   • existing person (phone match) → set ward + home village + reactivate;
//     name/role/title left untouched (don't clobber coordinators).
//   • new person → insert as 'canvasser' with name, phone, ward, title (nickname),
//     and home village.
// Missing villages named in the list are created (ward centroid, 'Other localities').
//
//   node tools/seed-ward-grassroots.cjs   (then regenerate village boundaries)

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const WARDS = {
  ziwa: '22222222-0000-4000-8000-000000000005',
  kadzandani: '22222222-0000-4000-8000-000000000001',
  mkomani: '22222222-0000-4000-8000-000000000003',
};

// [name, phoneRaw, wardKey, villageName|null, title|null]
const PEOPLE = [
  // ── Ziwa La Ng'ombe ──
  ['Francis Taurah',  '0723922193',    'ziwa', 'Vienna',      null],
  ['Dama Baya',       '103205658',     'ziwa', 'Kidogo Basi', null],  // "K/basi/Idd Kumbi"
  ['Joseph Mutemi',   '+254727680862', 'ziwa', 'Kisimani',    null],
  ['Mary Kazungu',    '0107519595',    'ziwa', 'Vienna',      null],
  ['Manoah Samson',   '0700658564',    'ziwa', 'Gichanga',    null],
  ['Brenda Wamalwa',  '+254102014700', 'ziwa', 'Tumaini',     null],
  // ── Kadzandani ── (no villages supplied)
  ['Mohamed Kofa Said',          '0712838800', 'kadzandani', null, null],
  ['Jane Nyengo Okeyo',          '0718689283', 'kadzandani', null, null],
  ['Rosemary Adhiambo',          '0714228602', 'kadzandani', null, 'Adhis'],
  ['Judith Asienga',             '0754266365', 'kadzandani', null, null],
  ['Mariam Dzame Ali',           '0729791838', 'kadzandani', null, 'Moonlight'],
  ['Bianca Akinyi Odhiambo',     '0115489778', 'kadzandani', null, null],
  ['Elizabeth Aloo Okeyo',       '0722772991', 'kadzandani', null, null],
  ['Joseph Njoroge Nginyo',      '0743190415', 'kadzandani', null, null],
  ['Arnold Baya',                '0706547972', 'kadzandani', null, null],
  ['Rehema Masha',               '0712451650', 'kadzandani', null, null],
  ['Juma Rassul Mwadzaya',       '0714592113', 'kadzandani', null, 'Editor'],
  ['Dessy Awour',                '0757845251', 'kadzandani', null, null],
  ['Caroline Ruwa',              '0790481808', 'kadzandani', null, 'Chair Lady'],
  // ── Mkomani ── (no villages supplied)
  ['Lucy Agutu',     '0702816974', 'mkomani', null, null],
  ['Faith Ngel',     '0718456180', 'mkomani', null, null],
  ['Diana Ogoye',    '0737014485', 'mkomani', null, null],
  ['Oscar',          '0712863480', 'mkomani', null, null],
  ['Sammy',          '0703754630', 'mkomani', null, null],
  ['Mercy',          '0712156983', 'mkomani', null, null],
];

function normPhone(raw) {
  let d = String(raw).replace(/[^0-9]/g, '');
  if (d.startsWith('254')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^[71]\d{8}$/.test(d) ? `+254${d}` : null;
}
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function villageId(wardId, name) {
  if (!name) return null;
  const t = norm(name);
  const found = await sql`
    SELECT id FROM villages WHERE ward_id = ${wardId} AND deleted_at IS NULL
      AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = ${t} LIMIT 1`;
  if (found.length) return found[0].id;
  const [ins] = await sql`
    INSERT INTO villages (ward_id, name, section, centroid)
    VALUES (${wardId}, ${name}, 'Other localities', (SELECT centroid FROM wards WHERE id = ${wardId}::uuid))
    RETURNING id`;
  return ins.id;
}

async function main() {
  let inserted = 0, updated = 0, villagesCreated = 0;
  const before = new Set((await sql`SELECT id FROM villages`).map((r) => r.id));

  for (const [name, phoneRaw, wardKey, village, title] of PEOPLE) {
    const phone = normPhone(phoneRaw);
    if (!phone) { console.log(`  ⚠ skipped ${name}: bad phone "${phoneRaw}"`); continue; }
    const wardId = WARDS[wardKey];
    const homeVillageId = await villageId(wardId, village);

    const existing = await sql`SELECT id FROM people WHERE phone = ${phone} LIMIT 1`;
    if (existing.length) {
      await sql`UPDATE people SET ward_id = ${wardId}, home_village_id = ${homeVillageId}, active = true, updated_at = now() WHERE id = ${existing[0].id}`;
      updated++;
    } else {
      await sql`
        INSERT INTO people (full_name, phone, role, ward_id, home_village_id, title, active)
        VALUES (${name}, ${phone}, 'canvasser', ${wardId}, ${homeVillageId}, ${title}, true)`;
      inserted++;
    }
  }

  const after = await sql`SELECT id FROM villages`;
  villagesCreated = after.length - before.size;
  console.log(`✓ Ward grassroots: ${inserted} inserted, ${updated} updated (existing). ${villagesCreated} new village(s) created.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
