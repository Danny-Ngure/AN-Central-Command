// Seed Ziwa La Ng'ombe schools (public / private / tertiary) + self-help groups
// into community_sites.
//
//   node tools/seed-ziwa-schools-welfare.cjs
//
// Idempotent: clears the school_*/welfare_group rows for the ward then re-inserts.
// Source: "SCHOOLS AND TARTIARY INSTITUTIONS IN ZIWA LA NG'OMBE WARD" PDF.
// Schools carry no contact details in the source; self-help groups list a
// chairperson + phone. Coordinate-less rows default to the ward centroid.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const ZIWA = '22222222-0000-4000-8000-000000000005';

function normPhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('254')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (/^[71]\d{8}$/.test(d)) return '+254' + d;
  return null;
}

// ── Schools: [name, type] ───────────────────────────────────────────────────
const SCHOOLS = [
  // Government / public (incl. special schools)
  ['Mombasa Secondary School for the Physically Handicapped', 'school_public'],
  ["Ziwa La Ng'ombe Primary School", 'school_public'],
  ['Azhahar Shariff Primary School', 'school_public'],
  ['Pwani School for the Mentally Handicapped', 'school_public'],
  // Private secondary
  ['Sheikh Khalifa Bin Zayed', 'school_private'],
  ['Mombasa Township Secondary', 'school_private'],
  ['Oshwal Academy', 'school_private'],
  ['Swaminarayan Secondary', 'school_private'],
  // Private primary
  ['Gracious Hope @ Smartbrains Academy', 'school_private'],
  ['Cool Eden Academy', 'school_private'],
  ['The Great Hope Star Preparatory School', 'school_private'],
  ['Saphy Junior School', 'school_private'],
  ['Olives Rehabilitation Centre', 'school_private'],
  ['Mujahidin Academy', 'school_private'],
  ['Victory Junior School', 'school_private'],
  ['Morning Star Academy', 'school_private'],
  ['New Dawn Academy', 'school_private'],
  ['Berits Junior School', 'school_private'],
  ['Tumaini Academy', 'school_private'],
  ['Bridge Academy', 'school_private'],
  ['Tumaini Kisauni Academy', 'school_private'],
  ['Shadai Comprehensive Primary School', 'school_private'],
  ['Bien Alliance Primary School', 'school_private'],
  ['Valour Angels Junior School', 'school_private'],
  ['Bright Academy Primary School', 'school_private'],
  ['Precious Twins Academy', 'school_private'],
  ['Bamka Primary School', 'school_private'],
  // Tertiary institutions
  ['National Industrial Training Authority (NITA)', 'school_tertiary'],
  ['Kenya School of Revenue Administration', 'school_tertiary'],
  ['Amani Tailoring', 'school_tertiary'],
];

// ── Self-help / welfare groups: [name, chairperson, phone] ──────────────────
const WELFARE = [
  ['Vitendo Tenda Self Help Group', 'Nelly Baya', '0728446111'],
  ['Kibunda Self Help Group', 'Fatuma Nyule', '0731510879'],
  ["Ziwa La Ng'ombe Mpya CBO", 'Beatrice Kazungu', '0720006725'],
  ['Vienna Homeland Self Help Group', 'Bonface Tsuma', '0708535451'],
  ['Sauti ya Akina Mama', 'Elizabeth Kivumbi', '0724016590'],
  ['Elite Self Help Group', 'Deche', '0746047107'],
  ['Asabito Women Group', 'Abdia Mohamed', '0723031693'],
  ['Kisimani Youth For Change', 'Derrick', '0728615291'],
  ['Tumaini Youth Sema Base High Life', 'Gideon Anezya', '0717111212'],
  ['Hatubahatishi Women Group', 'Sarah Keah', '0711143676'],
  ['Super Original Film Kenya (S.O.F Kenya)', 'Rashid Ali', '0706972737'],
  ['Kisimani Association Self Help Group', 'Jane', '0725935668'],
  ['Ziwa B Furaha Women Self Help Group', 'Ruth Ibore', '0702022110'],
  ['Ziwa A Active Women Self Help Group', 'Tabu Yakwe', '0713564384'],
  ['Ushirikiano Self Help Group', 'Caroline Chacha', '0708771557'],
  ['Vijana Vision Self Help Group', 'Nicholas Jum', '0724940217'],
  ['Gichanga Black City', 'Judith Adhiambo', '0728657133'],
  ['Tusaidiane Pamoja Self Help Group', 'Chrisphine Ogola', '0100749767'],
  ['Crisco Self Help Group', 'Hellen Ogutu', '0713419156'],
  ['Munawar Self Help Group', 'Fatuma Iddi', '0718860408'],
  ['Leisure Pamoja Self Help Group', 'Mwanakombo Abdalla', '0711801192'],
  ['Nia Njema Self Help Group', 'Asma Iddi', '0706831306'],
  ['Like Minded Women Group', 'Calister Wughanga', '0717130257'],
  ['Sisi Kwa Sisi Women Group', 'Irene Kituku', '0701099544'],
  ['Kongowea Tailoring Group', 'Amina Haji', '0743297435'],
  ['Team Jirani Self Help Group', 'Warda Abdirahman', '0713402333'],
  ['Shining Flower Women Group', 'Miriam Kavili', '0721842312'],
  ['Women Of Change Self Help Group', 'Vigilance Maghanga', '0721664361'],
  ['KICODEP', 'Samson Chai', '0721749487'],
  ['HAEGKUA UMOJA PAMOJA', 'Julius Kiragu', '0712672945'],
  ['Nia Jjema Self Help Group', 'Salma Swaleh', '0706831306'],
  ['Nyali Riders Self Help Group', 'Charity Gakii', '0728583692'],
  ['United Self Help Group', 'Albert Onyango', '0724630571'],
  ['Lukundo Self Help Group', 'Janet Chari', '0741698103'],
  ['Long Rich Self Help Group', 'Bilia Navalayo', '0726977540'],
  ['Kisimani Community Unit Self Help Group', 'Mwanakombo Athman', '0793705086'],
  ['Pamoja Mpya Self Help Group', 'Ruth Andisi', '0711635106'],
  ['Maisha Bora Self Help Group', 'Fatuma Bakari', '0712826635'],
  ['Nafwahirwa Self Help Group', 'Mwanaisha Kaure', '0712449262'],
  ['Breakthrough Self Help Group', 'Miriam Kimemia', '0729201601'],
  ['Beba Nikubebe Self Help Group', 'Rachael Mbenga', '0718800830'],
  ['Wereka Self Help Group', 'Evans Simiyu', '0700779375'],
];

async function main() {
  await sql`
    DELETE FROM community_sites
    WHERE ward_id = ${ZIWA}
      AND type IN ('school_public','school_private','school_tertiary','welfare_group')
  `;

  const centroid = sql`(SELECT centroid FROM wards WHERE id = ${ZIWA}::uuid)`;

  let schools = 0;
  for (const [name, type] of SCHOOLS) {
    await sql`
      INSERT INTO community_sites (type, name, location, ward_id, area_name)
      VALUES (${type}, ${name}, ${centroid}, ${ZIWA}, ${"Ziwa La Ng'ombe"})
    `;
    schools++;
  }

  let welfare = 0;
  for (const [name, person, phone] of WELFARE) {
    await sql`
      INSERT INTO community_sites
        (type, name, location, ward_id, contact_person_name, contact_phone, contact_role, area_name)
      VALUES
        ('welfare_group', ${name}, ${centroid}, ${ZIWA},
         ${person || null}, ${normPhone(phone) ?? phone ?? null}, 'Chairperson', ${"Ziwa La Ng'ombe"})
    `;
    welfare++;
  }

  const pub = SCHOOLS.filter((s) => s[1] === 'school_public').length;
  const priv = SCHOOLS.filter((s) => s[1] === 'school_private').length;
  const tert = SCHOOLS.filter((s) => s[1] === 'school_tertiary').length;
  console.log(`✓ Ziwa La Ng'ombe schools: ${schools}  (public ${pub}, private ${priv}, tertiary ${tert})`);
  console.log(`✓ Ziwa La Ng'ombe welfare: ${welfare}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
