// Mkomani schools + groups/welfare (from "Schools and welfares.pdf") and the
// team-member village assignments for Mkomani. Idempotent: upsert by (ward, name).
//
//   node tools/seed-mkomani-schools-welfare.cjs

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const MKOMANI = '22222222-0000-4000-8000-000000000003';

// Schools: [name, type, village]
const SCHOOLS = [
  ['Maweni Secondary School', 'school_secondary', 'Kisumu Ndogo'],
  ['Maweni Primary School',   'school_public',    'Kisumu Ndogo'],
  ['Penrose Primary School',  'school_public',    'Shauri Yako'],
  ['St Elizabeth Preparatory School', 'school_private', 'Kisumu Ndogo'],
  ['Pwani Star Academy',       'school_private', 'Kisumu Ndogo'],
  ['Angel Junior Academy',     'school_private', 'Kisumu Ndogo'],
  ['Great Vision Academy',     'school_private', 'Kisumu Ndogo'],
  ['Nyali Hills Academy',      'school_private', 'Kisumu Ndogo'],
  ['Nyali Primary School',     'school_private', 'Mkomani'],
  ['Mkomani Academy',          'school_private', 'Mkomani'],
  ['New Junior',               'school_private', 'Mkomani'],
  ['Mkomani Township',         'school_private', 'Mkomani'],
  ['Aljafa Academy',           'school_private', 'Mkomani'],
  ['St Francis Academy',       'school_private', 'Shauri Yako'],
  ['Cornerstone Academy',      'school_private', 'Shauri Yako'],
  ['Milele Academy',           'school_private', 'Shauri Yako'],
  ["Nyota Ing'arayo Academy",  'school_private', 'Shauri Yako'],
  ['Mnazi Mmoja Primary',      'school_private', 'Shauri Yako'],
  ['Mountain Pen Mixed Secondary', 'school_private', 'Kisumu Ndogo'],
  ['St Francis Mixed Secondary',   'school_private', 'Kisumu Ndogo'],
  ['Mwangaza Academy',         'school_private', 'Shauri Yako'],
  ['Little Angel Academy',     'school_private', 'Kisumu Ndogo'],
  ['Bamka Academy',            'school_private', 'Kisumu Ndogo'],
  ['Harvard Secondary School', 'school_private', null],
];
const SCHOOL_TYPES = ['school_public', 'school_private', 'school_secondary', 'school_primary', 'school_tertiary', 'school_other'];

// Groups & welfare: [name, leader, role, phoneRaw, village]
const WELFARE = [
  ['Falcon Media Services Youth Group', 'Ochieng Odhiambo', 'Chairman',    '0787530335', null],
  ['Majirani Focus',                    'Mama Eva',         'Chair lady',  '0715134766', null],
  ['Maweni Bustani Youth Group',        'Bradley',          'Chairman',    '0723721514', 'Maweni'],
  ['Miami Sisters',                     'Betty',            'Chair lady',  '0115321961', null],
  ['Wamama Wema',                       'Teresa',           'Chair lady',  '0705805038', null],
  ['Green Ledgers CBO',                 'Ochieng',          'Chairman',    '0700412496', null],
  ['Nyali Phase 2',                     'Sammy',            'Chairman',    '0702340844', 'Nyali'],
  ['Ambitious Ladies 001',              'Faith',            'Chair lady',  '0718456180', null],
  ['Super Women Mkomani',               'Asha',             'Chair lady',  '0708416712', 'Mkomani'],
  ['Wereca Real Focus Mkomani',         'Robert',           'Chairman',    '0706978482', 'Mkomani'],
  ['Mkomani United Self Help Group',    'Innocent Waweru',  'Chairperson', '0742762373', 'Mkomani'],
  ['Majirani Umoja Welfare',            'Olive Wamachi',    'Chairperson', '0748076941', null],
  ['Milele Sisters Mkomani',            'Anyango',          'Chair lady',  '0717457865', 'Mkomani'],
  ['GT Youths Mnazi Mmoja',             'Boaz Oduor',       'Chairman',    '+254713371722', 'Mnazi Moja'],
  ['Roho Safi Self Help Group',         'Shaduz',           'Chairman',    '+254798300193', null],
  ['Mnazi Moja Boda Boda',              'Shaduz',           'Chairman',    '+254798300193', 'Mnazi Moja'],
];

// Team member home villages (by phone).
const TEAM_VILLAGES = [
  ['0702816974', 'Kisumu Ndogo'], // Lucy Agutu
  ['0718456180', 'Show Ground'],  // Faith Ngel
  ['0712863480', 'Shauri Yako'],  // Oscar
  ['0712156983', 'Shauri Yako'],  // Mercy
  ['0703754630', 'Kisumu Ndogo'], // Sammy
  ['0737014485', 'Kisumu Ndogo'], // Diana Ogoye
];

const tight = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function normPhone(raw) {
  let d = String(raw).replace(/[^0-9]/g, '');
  if (d.startsWith('254')) d = d.slice(3); else if (d.startsWith('0')) d = d.slice(1);
  return /^[71]\d{8}$/.test(d) ? `+254${d}` : null;
}
const welfareType = (name) =>
  /self help|self-help/i.test(name) ? 'self_help_group' : /boda/i.test(name) ? 'boda_stage' : 'welfare_group';

async function main() {
  const villageRows = await sql`SELECT id, name FROM villages WHERE ward_id = ${MKOMANI} AND deleted_at IS NULL`;
  const vById = (name) => {
    if (!name) return null;
    const t = tight(name);
    return villageRows.find((v) => tight(v.name) === t) || villageRows.find((v) => tight(v.name).includes(t) || t.includes(tight(v.name)));
  };
  const centroid = sql`(SELECT centroid FROM wards WHERE id = ${MKOMANI}::uuid)`;

  let schoolsIns = 0, schoolsUpd = 0;
  for (const [name, type, village] of SCHOOLS) {
    const v = vById(village);
    const existing = await sql`
      SELECT id FROM community_sites WHERE ward_id = ${MKOMANI} AND deleted_at IS NULL
        AND type = ANY(${SCHOOL_TYPES}) AND regexp_replace(lower(name),'[^a-z0-9]','','g') = ${tight(name)} LIMIT 1`;
    if (existing.length) {
      await sql`UPDATE community_sites SET type=${type}, village_id=COALESCE(village_id,${v ? v.id : null}), area_name=COALESCE(NULLIF(area_name,''),${village}), updated_at=now() WHERE id=${existing[0].id}`;
      schoolsUpd++;
    } else {
      await sql`INSERT INTO community_sites (type, name, location, ward_id, village_id, area_name)
                VALUES (${type}, ${name}, ${centroid}, ${MKOMANI}, ${v ? v.id : null}, ${village})`;
      schoolsIns++;
    }
  }

  let welfIns = 0, welfUpd = 0;
  for (const [name, leader, role, phoneRaw, village] of WELFARE) {
    const v = vById(village);
    const phone = normPhone(phoneRaw);
    const type = welfareType(name);
    const existing = await sql`
      SELECT id FROM community_sites WHERE ward_id = ${MKOMANI} AND deleted_at IS NULL
        AND regexp_replace(lower(name),'[^a-z0-9]','','g') = ${tight(name)} LIMIT 1`;
    if (existing.length) {
      await sql`UPDATE community_sites SET type=${type}, contact_person_name=${leader}, contact_role=${role}, contact_phone=${phone}, village_id=COALESCE(village_id,${v ? v.id : null}), area_name=COALESCE(NULLIF(area_name,''),${village}), updated_at=now() WHERE id=${existing[0].id}`;
      welfUpd++;
    } else {
      await sql`INSERT INTO community_sites (type, name, location, ward_id, village_id, area_name, contact_person_name, contact_role, contact_phone)
                VALUES (${type}, ${name}, ${centroid}, ${MKOMANI}, ${v ? v.id : null}, ${village}, ${leader}, ${role}, ${phone})`;
      welfIns++;
    }
  }

  let teamUpd = 0;
  for (const [phoneRaw, village] of TEAM_VILLAGES) {
    const v = vById(village);
    if (!v) continue;
    const r = await sql`UPDATE people SET home_village_id=${v.id}, updated_at=now() WHERE phone=${normPhone(phoneRaw)} RETURNING id`;
    teamUpd += r.length;
  }

  console.log(`✓ Mkomani schools: ${schoolsIns} new, ${schoolsUpd} updated. Welfare/groups: ${welfIns} new, ${welfUpd} updated. Team villages set: ${teamUpd}.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
