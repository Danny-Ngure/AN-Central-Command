// Seed Kadzandani schools + welfare groups into community_sites.
//
//   node tools/seed-kadzandani-schools-welfare.cjs
//
// Idempotent: deletes existing school_public/school_private/welfare_group rows
// for Kadzandani, then re-inserts from the lists below. Sites with no supplied
// coordinates default to the ward centroid (same as the data-import path).
//
// Source: img20260618 "KADZANDANI SCHOOLS" (39 schools; only Kadzandani Primary
// is Public) + "KADZANDANI WELFARE GROUPS" (75 groups). Head-teacher / contact
// names and phones transcribed from the scans — a few low-confidence cells are
// flagged in the handoff notes.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const KADZANDANI = '22222222-0000-4000-8000-000000000001';

function normPhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('254')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (/^[71]\d{8}$/.test(d)) return '+254' + d;
  return null;
}

// ── Schools: [name, headTeacher, phone, village, isPublic] ──────────────────
const SCHOOLS = [
  ['Bridge of Hope International', 'Billy Ogella', '0719192449', 'Kadzandani', false],
  ['Kadzandani Primary School', 'Mnuhe Ndungo', '0720949191', 'Kadzandani', true],
  ['Bamburi Great News School', 'Isaac Ongaga Gugwa', '0718674351', 'Bamburi Masters', false],
  ['Dawn Light Academy', 'Dominic Mogaka', '0705861998', 'Kadzandani', false],
  ['Faith Academy', 'Thomas Karisa', '0721400394', 'Kadzandani', false],
  ['Bridge of Hope Academy', 'Peter Gitahi', '0719317989', 'Kadzandani', false],
  ['Happy Star Academy', 'Vigilant Wakaitho', '0727165382', 'Kadzandani', false],
  ['Teman Academy', 'Gaystone Mwangombe', '0721410202', 'Bamburi Masters', false],
  ['Coral Junior Academy', 'Judith Kemunto', '0727148957', 'Bamburi Mwaisho', false],
  ['Bashir Academy School', 'Mohamed Juma', '0720915252', 'Bashir', false],
  ['Glorious Cornerstone Academy', 'Agnes Bahati', '0707419648', 'Kadzandani', false],
  ['Nedika Academy', 'Stanley Mwapaka', '0798229374', 'Pandya', false],
  ['St. Michael High School', 'Raphael Ayieko', '0720813144', 'Mafisini', false],
  ['Gremon High School', 'Nancy Momanyi', '0726270386', 'Kadzandani', false],
  ['Gods Care Center', 'Beatrice Mahugu', '0713473962', 'Pandya', false],
  ['Bakecstar Education Center', 'Betty', '0723600658', 'Pandya', false],
  ['Coast Progressive High School', 'Dalmas Otieno', '0731462283', 'Mtopanga', false],
  ['Great Shiners Community', 'Omar Bakari', '0724224733', 'Mafisini', false],
  ['Bamburi Royal Academy', 'Sylvester Amondo', '0720232321', 'Bamburi', false],
  ['Grace Field Academy', 'Betty Mashaka', '0724225724', 'Bamburi', false],
  ['Future Winners Academy', 'Thethe Koi', '0704265952', 'Kadzandani', false],
  ['Young Elite Academy', 'Philip Kalama', '0711924324', 'Kadzandani', false],
  ['Star Junior Academy', 'Joseph Otieno', '0728818897', 'Bamburi', false],
  ['Shines Junior Academy', 'Tabitha Onsongo', '0726099395', 'Mtopanga', false],
  ['Island View Academy', 'Fatima Khalid', '0703139697', 'Mtopanga', false],
  ['Northern Coast High School', 'Munira Yusuf', '0721538121', 'Mtopanga', false],
  ['Precious Star Academy', 'Godwin Omollo', '0703560901', 'Mtopanga', false],
  ['Liberty Primary and Nursery School', 'Mr. Kitty', '0721532824', 'Kadzandani', false],
  ['Doddington Academy', 'Salome Simiyu', '0701594710', 'Bullo', false],
  ['Pioneer Academy', 'Mariam Shee', '0711729549', 'Bullo', false],
  // ── page 2 ──
  ['Millennium Kindergarten and Primary', 'Hellen Salome Ndege', '0720126574', 'Bombolulu Estate ii', false],
  ['Mwaisil Academy', 'Salome Mukulu', '0727544263', 'Bombolulu Estate ii', false],
  ['St. Mary Academy', 'David Wambua', '0721248828', 'Bombolulu Estate ii', false],
  ['Dhun-nurain Intergrated Academy', 'Said Bwire', '0707972104', 'Bamburi Mwaisho', false],
  ['Griffins Nurture School', 'Griffin Sandi', '0711691831', 'Bullo Kashani', false],
  ['Nick Pears Memorial Academy', 'Maryane Maingi', '0765517433', 'Bullo Kashani', false],
  ['Tarabha Daily Care', 'Eunice Shuma', '0726519899', 'Bullo Kashani', false],
  ['Roline Secondary School', 'Mr. Katana', '0703715553', 'Bullo Mudini', false],
  ['Talent High School', 'Mr. Wainaina', '0723982075', 'Bella Plaza', false],
];

// ── Welfare groups: [name, contactPerson, phone] ────────────────────────────
const WELFARE = [
  ['Amani Boda Boda-SHG', 'Kennedy Omollo', '0721459794'],
  ['Colanasee-CBO', 'Winnie Akinyi', '0718210054'],
  ['Kashani Garbage Collectors', 'Joseph Ouma', '0790488233'],
  ['Lengo Youth Group', 'Kahindi Karisa Mramba', '0791185538'],
  ['Baraka Youth Group', 'Khamisi Suleiman', '0743143731'],
  ['Maeneo Youth Group', 'Matano Samuel', '0707089021'],
  ['Chengoni Youth Group', 'Harun Mustafa', '0793936802'],
  ['Elite SHG', 'Emily Anjago', '0703477845'],
  ['Mafisini SHG', 'Hadija Ali', '0710953921'],
  ['Shufaa Women Group', 'Christine Chengo', '0727689390'],
  ['Kadzandani SHG', 'Nyadzua Ezekiel Saha', '0724069830'],
  ['Bombolulu SHG', 'Nuru Juma Muselem', '0724606321'],
  ['Mtopanga SHG', 'Debra Odera', '0740299535'],
  ['Teule Women Group', 'Mwanaidi Hassan', '0733919750'],
  ['Meridian Ladies C.B.O', 'Aloice Mwiruri Kariha', '0720473815'],
  ['Great Grace C.B.O', 'Joyce Borori', '0716702366'],
  ['United Kadzandani Women Group', 'Samuel Mtwana', '0714171410'],
  ['Bamburi S.H.G', 'Morris Asienwa', '0725225563'],
  ['Unity S.H.G', 'Barawa Lewa', '0723601908'],
  ['Salina S.H.G', 'Mwanasiti Juma', '0727122894'],
  ['Galanema Youth Group', 'Catherine Mbugwa', '0712166477'],
  ['Al-hisan Women Group', 'James Abogi', '0711799769'],
  ['Upendo Na Imani S.H.G', 'Edward Kaingu', '0713049907'],
  ['End Time Youth Group', 'Ali Kulumba', '0746008357'],
  ['Pass Moja Youth Group', null, null],
  ['Kadzandani Tuinuane Youth Group', 'Stella Kakai', '0726524372'],
  ['Njooni Disability S.H.G', 'Samuel Kazungo', '0791218047'],
  ['Mama Uwezo Women Group', 'Faith Nzilani', '0700453030'],
  ['Vuna C.B.O', null, null],
  ['Step Up With Special Need S.H.G', null, null],
  ['Kisimani Friends Youth Group', null, null],
  ['Human Protection And Justice C.B.O', 'Rocky Dea', '0724136274'],
  ['Mlezi Women Group', 'Emily Maganga', '0723049593'],
  ['Amazon Boda Boda S.H.G', 'John Mwigai', '0723643909'],
  ['Bright Ladies Women Group', 'Dorris Mombo', null],
  ['Jamii Moja Support Group', 'Monica Kavere', '0728428675'],
  ['Trends Setter Youth Group', 'Mary Mwarome', '0701742312'],
  ['Malindi Store Youth Group', 'Shadrack Bwenye', null],
  ['Youth Empowerment And Activisim C.B.O', 'Sharon Nyokabi', null],
  ['Tatizo Welfare Group', 'Baraka Mwagure', '0743179506'],
  ['Takwa S.H.G', 'Fatuma Musa', '0710174589'],
  ['Musilini Welfare Group', 'James Kiari', '0722884377'],
  ['Nyota Women Group', null, null],
  ['Amazon S.H.G', 'Fidel Ngala', '0727934100'],
  ['Mifugo Women Development Group', null, '0725249073'],
  ['Bamburi Dispensary Boda Boda', 'Karisa Kazungu Kalama', '0717225495'],
  ['Da-Pendo S.H.G', 'Omar Khamis', '0768339116'],
  ['Ten Up Group', 'Nathaniel Owino', '0757790507'],
  ['Gema Bamburi', 'Raphael Ngige', '0725258054'],
  ['Tumaini Letu SHG', 'Joshua Onkoba', null],
  ['Kadzandani Muslim Teachers', 'Said Kofa Wayu', null],
  ['Kushe SHG', 'Lucy Ambeyi', '0700317377'],
  ['Step up Pandya Youth Group', 'Lucky Fondo', null],
  ['Step up Pandya Org', 'Edgar John Malle', '0701621004'],
  ['Mombasa Future Builders', 'Hesbon Okari Mautia', '0743094506'],
  ['We For She CBO', 'Winnie Mweni', '0720820917'],
  ['Trail Blazers CBO', 'Sophy Njoka', null],
  ['Dupoto Maa Group', 'Ibrahim Gideon', null],
  ['Community Empowerment on Environmental Change', 'Gevarse Muthiani', null],
  ['KayDee-Ziwani SHG', 'Said Juma Sketty', '0733741559'],
  ['Jenga Kazi SHG', 'Harrison Ochenge', null],
  ['Golden Dadas', 'Lammy Kainyu', '0720283485'],
  ['The Great Achievers', 'Abel Abele', '0768782727'],
  ['Mwatamba Empowerment SHG', 'Juma Mumba', '0728950589'],
  ['Tujiinue Parents with Kids with Disability', 'Grace Kalechi', '0708810892'],
  ['Women Kadzandani Group', 'Mamake Omari', '0722837269'],
  ['Kina Mama Poa Group', null, '0722106129'],
  ['Twelve Month Challenge SHG', 'Evaline Adhis', '0796697137'],
  ['Gifted Ladies Women Group', null, null],
  ['Mji Mpya Women Group', null, null],
  ['Mwatamba Empowement SHG', 'Mumba', null],
  ['Wipe Tears Women Group', 'Emily', null],
  ['Better Tomorrow Women Group', 'Loice Osman', null],
  ['Village Elders Initiative Group', null, null],
  ['Kadzandani Ward CBO', null, null],
];

async function main() {
  // Idempotent reset of just these categories in Kadzandani.
  await sql`
    DELETE FROM community_sites
    WHERE ward_id = ${KADZANDANI}
      AND type IN ('school_public','school_private','welfare_group')
  `;

  const centroid = sql`(SELECT centroid FROM wards WHERE id = ${KADZANDANI}::uuid)`;

  let schools = 0;
  for (const [name, head, phone, village, isPublic] of SCHOOLS) {
    await sql`
      INSERT INTO community_sites
        (type, name, location, ward_id, contact_person_name, contact_phone, contact_role, area_name)
      VALUES
        (${isPublic ? 'school_public' : 'school_private'}, ${name}, ${centroid}, ${KADZANDANI},
         ${head || null}, ${normPhone(phone) ?? phone ?? null}, 'Head Teacher', ${village || null})
    `;
    schools++;
  }

  let welfare = 0;
  for (const [name, person, phone] of WELFARE) {
    await sql`
      INSERT INTO community_sites
        (type, name, location, ward_id, contact_person_name, contact_phone, contact_role, area_name)
      VALUES
        ('welfare_group', ${name}, ${centroid}, ${KADZANDANI},
         ${person || null}, ${normPhone(phone) ?? phone ?? null}, 'Contact Person', 'Kadzandani')
    `;
    welfare++;
  }

  const pub = SCHOOLS.filter((s) => s[4]).length;
  console.log(`✓ Kadzandani schools:  ${schools}  (public ${pub}, private ${schools - pub})`);
  console.log(`✓ Kadzandani welfare:  ${welfare}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
