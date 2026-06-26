// Tag every village with its section (see /meetings map + handoff notes).
//
//   node tools/seed-village-sections.cjs
//
// Idempotent: matches by ward + normalised (lower/trimmed) village name, so the
// case-variant duplicate rows (e.g. "FRERE TOWN" / "Frere Town") both get the
// same section. Reports any village it couldn't place.

const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const WARDS = {
  freretown: '22222222-0000-4000-8000-000000000004',
  kadzandani: '22222222-0000-4000-8000-000000000001',
  kongowea: '22222222-0000-4000-8000-000000000002',
  mkomani: '22222222-0000-4000-8000-000000000003',
  ziwa: '22222222-0000-4000-8000-000000000005',
};

// section label -> [village names]. Matching is case-insensitive + trimmed.
const SECTIONS = {
  freretown: {
    'Bakarani / Barisheba': ['Bakarani Kanu', 'Bakarani Phase 1', 'Bakara Phase 4', 'Barisheba Mashauri', 'Barisheba Phase 2', 'Barisheba Phase 5'],
    'Mbungoni / Mgongeni': ['Matopeni Mbungoni', 'Mbungoni Phase 1', 'Mbungoni Phase 2', 'Mgingeni Phase 1', 'Mgongeni Phase 2'],
    'Bombolulu / Mlaleo': ['Bombolulu Phase 2', 'Bombolulu Slum', 'Mlaleo', 'Mlaleo Ashura'],
    'Frere Town core': ['Frere Town', 'Hadija Estate', 'Hakika', 'Katisha', 'Majengo Mapya', 'Marhaba', 'Sarajevo', 'Shelemba'],
  },
  kadzandani: {
    'Bamburi': ['Bamburi Lakeview', 'Bamburi Maeneo', 'Bamburi Msikitini', 'Bamburi Naivas'],
    'Bombolulu': ['Bombolulu', 'Bombolulu(Bella)', 'Bombolulu Estate l', 'Bombolulu Posta A', 'Bombolulu posta B'],
    'Bullo': ['Bullo Kashani A', 'Bullo Kashani B', 'Bullo Msufini A', 'Bullo Msufini B', 'Bullo Timboni B'],
    'Kadzandani / Mwatamba': ['Kadzandani', 'Kadzandani A', 'Kadzandani B', 'Kadzandani C', 'Mafisini', 'Majengo Kaydee', 'Malindi Store', 'Masters A', 'Masters B', "M'Bungoni", 'Mwatamba', 'Mwatamba Dhanjal', 'Mwatamba Gorofani', 'Pandya', 'Stage ya Paka A', 'Stage ya Paka B'],
  },
  kongowea: {
    'Kongowea central': ['Chief Area', 'Harambee', 'Kongowea', 'Kongowea A', 'Kongowea Sch'],
    'Karama / Kambi Kikuyu': ['Kambi Kikuyu', 'Kambi Kikuyu B', 'Karama', 'Kiangai', 'Uanja wa Mbuzi'],
    'Ratna / Kadiria': ['Badiria', 'Kadiria', 'Kitaruni', 'Masandukuni', 'Ratna', 'Ratna Mula'],
    'Matopeni / Kangi': ['African Bar', 'Bahari Club', 'Jerusalem', 'Kangi', 'Matopeni A', 'Matopeni B'],
  },
  mkomani: {
    'Nyali estate': ['Mkomani', 'Mnazi Moja', 'Nyali'],
    'Kisumu Ndogo & Maweni': ['Kisumu Ndogo', 'Maweni', 'Shauri Yako', 'Show Ground'],
  },
  ziwa: {
    'Ziwa core': ['Kisimani', 'Kisimani A', 'Kisimani B', 'V.O.K', 'Vienna', 'Ziwa La Ng\'ombe'],
    'Kidogo Basi / Kambi ya Moto': ['Iddi Kumbi', 'IDD KUMBI', 'Kambi ya Moto', 'Kidogo Basi', 'Kidogobasi', 'Mkunguni'],
    'Shanzu / north': ['Kenol', 'Khadija', 'Mogadishu Estate', 'Nyali Estate', 'Shanzu', 'Timboni', 'Kangi', 'Maweni'],
  },
};

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  let updated = 0;
  const unmatched = [];

  for (const [wardKey, wardId] of Object.entries(WARDS)) {
    // Build name -> section lookup for this ward.
    const lookup = new Map();
    for (const [section, names] of Object.entries(SECTIONS[wardKey])) {
      for (const n of names) lookup.set(norm(n), section);
    }

    const rows = await sql`
      SELECT id, name FROM villages WHERE ward_id = ${wardId} AND deleted_at IS NULL
    `;
    for (const r of rows) {
      const section = lookup.get(norm(r.name));
      if (!section) { unmatched.push(`${wardKey}: ${r.name}`); continue; }
      await sql`UPDATE villages SET section = ${section}, updated_at = now() WHERE id = ${r.id}`;
      updated++;
    }
  }

  console.log(`✓ Tagged ${updated} village rows with a section.`);
  if (unmatched.length) {
    console.log(`⚠ ${unmatched.length} unmatched (left null):`);
    unmatched.forEach((u) => console.log(`   - ${u}`));
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
