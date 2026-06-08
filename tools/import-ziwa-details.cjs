// One-off importer for Ziwa La Ng'ombe coordinator records:
//   - Village elders/managers (18 inline + village managers from the empowerment PDF)
//   - Churches / mosques / schools (Empowerment Program PDF)
//   - Boda boda stages (Boda PDF)
//   - Village challenges -> village_issues (CHALLENGES.pdf + inline)
//
// Mirrors packages/db/src/seed conventions. Idempotent (natural-key skip). Run as
// DB owner (alfayo, bypasses RLS):  node tools/import-ziwa-details.cjs
//
const fs = require('node:fs');
const path = require('node:path');
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const DATA = process.env.ZIWA_JSON || 'C:\\Users\\User\\Downloads\\ziwa_parsed.json';
const WARD_NAME = 'Ziwa La Ng\'ombe';
const SUBLOC = 'Ziwa La Ng\'ombe';
const OWNER_PERSON_ID = '66666666-0000-4000-8000-000000000009'; // Robert Ndwiga, Ziwa ward coordinator
const ACTOR_PERSON_ID = '66666666-0000-4000-8000-000000000002'; // Sarah Manager (campaign_manager)
const ACTOR_ROLE = 'campaign_manager';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }
const sql = postgres(url, { max: 1 });
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  const { villages, leaders, sites, issues } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const c = { villages: 0, leaders: 0, sites: 0, issues: 0, skLeaders: 0, skSites: 0, skIssues: 0 };

  await sql.begin(async (sql) => {
    const [ward] = await sql`SELECT id FROM wards WHERE name = ${WARD_NAME}`;
    if (!ward) throw new Error('Ziwa ward not found');
    const wardId = ward.id;

    // sub-location
    let [sub] = await sql`SELECT id FROM sub_locations WHERE ward_id=${wardId} AND lower(name)=${norm(SUBLOC)} LIMIT 1`;
    if (!sub) {
      [sub] = await sql`INSERT INTO sub_locations (ward_id, name, centroid)
        VALUES (${wardId}, ${SUBLOC}, (SELECT centroid FROM wards WHERE id=${wardId})) RETURNING id`;
      console.log('  + sub-location:', SUBLOC);
    }
    const subId = sub.id;

    // villages
    const ev = await sql`SELECT id, lower(name) n FROM villages WHERE ward_id=${wardId}`;
    const vmap = new Map(ev.map((v) => [v.n, v.id]));
    for (const name of villages) {
      if (vmap.has(norm(name))) continue;
      const [r] = await sql`INSERT INTO villages (ward_id, sub_location_id, name, centroid)
        VALUES (${wardId}, ${subId}, ${name}, (SELECT centroid FROM wards WHERE id=${wardId})) RETURNING id`;
      vmap.set(norm(name), r.id); c.villages++;
    }
    const fallbackVillage = vmap.get(norm(WARD_NAME));

    // leaders — skip if (name+role) OR phone already present in ward
    const el = await sql`SELECT lower(full_name) n, lower(role_title) r, phone FROM community_leaders WHERE ward_id=${wardId}`;
    const lkey = new Set(el.map((x) => `${x.n}|${x.r}`));
    const lph = new Set(el.filter((x) => x.phone).map((x) => x.phone));
    for (const l of leaders) {
      const villageId = vmap.get(norm(l.village)) || fallbackVillage;
      const k = `${norm(l.fullName)}|${norm(l.roleTitle)}`;
      if (lkey.has(k) || (l.phone && lph.has(l.phone))) { c.skLeaders++; continue; }
      lkey.add(k); if (l.phone) lph.add(l.phone);
      await sql`INSERT INTO community_leaders
        (full_name, phone, role_title, village_id, ward_id, owned_by_person_id, sensitive_notes)
        VALUES (${l.fullName}, ${l.phone || null}, ${l.roleTitle}, ${villageId}, ${wardId},
                ${OWNER_PERSON_ID}, ${'Imported from Ziwa La Ng\'ombe coordinator records.'})`;
      c.leaders++;
    }

    // sites — fuzzy dedupe vs existing ward sites
    const es = await sql`SELECT lower(name) n FROM community_sites WHERE ward_id=${wardId}`;
    const snames = es.map((x) => x.n);
    const dup = (name) => { const n = norm(name); return snames.some((e) => e === n || e.includes(n) || n.includes(e)); };
    for (const s of sites) {
      if (dup(s.name)) { c.skSites++; continue; }
      snames.push(norm(s.name));
      const villageId = s.areaName ? (vmap.get(norm(s.areaName)) || null) : null;
      await sql`INSERT INTO community_sites
        (type, name, location, ward_id, village_id, area_name, estimated_size,
         contact_person_name, contact_role, contact_phone, visited, visited_at, visit_notes)
        VALUES (${s.type}, ${s.name}, (SELECT centroid FROM wards WHERE id=${wardId}), ${wardId},
                ${villageId}, ${s.areaName || null}, ${s.estimatedSize ?? null},
                ${s.contactPersonName || null}, ${s.contactRole || null}, ${s.contactPhone || null},
                ${!!s.visited}, ${s.visited ? sql`now()` : null},
                ${s.visited ? 'Recorded as visited in Ziwa La Ng\'ombe coordinator ground-mapping records.' : null})`;
      c.sites++;
    }

    // village issues — skip if same title already in ward
    const ei = await sql`SELECT lower(title) t FROM village_issues WHERE ward_id=${wardId}`;
    const iset = new Set(ei.map((x) => x.t));
    for (const it of issues) {
      const villageId = vmap.get(norm(it.villageName)) || fallbackVillage;
      if (iset.has(norm(it.title))) { c.skIssues++; continue; }
      iset.add(norm(it.title));
      await sql`INSERT INTO village_issues
        (village_id, ward_id, category, title, description, severity, status, verified, reported_by_person_id)
        VALUES (${villageId}, ${wardId}, ${it.category}, ${it.title}, ${it.description || null},
                ${it.severity}, 'reported', false, ${OWNER_PERSON_ID})`;
      c.issues++;
    }

    const ctx = { source: 'coordinator_file_import', ward: WARD_NAME,
      files: ['CHALLENGES.pdf', 'ALFAYO NELSON HOPE FOUNDATION EMPOWERMENT PROGRAM ZIWA WARD.pdf', "ZIWA LA NG'OMBE BODA BODA STAGES.pdf", 'inline village/elder/challenge text'] };
    for (const [action, et, payload] of [
      ['IMPORT_COMMUNITY_LEADERS', 'community_leader', { inserted: c.leaders, skipped: c.skLeaders, villagesCreated: c.villages }],
      ['IMPORT_SITES', 'community_site', { inserted: c.sites, skipped: c.skSites }],
      ['IMPORT_VILLAGE_ISSUES', 'village_issue', { inserted: c.issues, skipped: c.skIssues }],
    ]) {
      await sql`INSERT INTO audit_log (actor_person_id, actor_role, action, entity_type, after_value, context)
        VALUES (${ACTOR_PERSON_ID}, ${ACTOR_ROLE}, ${action}, ${et}, ${sql.json(payload)}, ${sql.json(ctx)})`;
    }
  });

  console.log('\nImport complete:', c);
}
main().then(() => sql.end()).catch((e) => { console.error('\nImport failed:', e); sql.end(); process.exit(1); });
