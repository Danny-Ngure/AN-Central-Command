// One-off importer for Mkomani coordinator records:
//   - Assistant Chief + mama/baba mtaa  -> community_leaders
//   - Churches (visited) + 16 boda stages (stages.pdf) -> community_sites
//   - Youth/women/men challenges -> village_issues
// Idempotent; run as DB owner:  node tools/import-mkomani-details.cjs
const fs = require('node:fs');
const path = require('node:path');
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const DATA = process.env.MKOMANI_JSON || 'C:\\Users\\User\\Downloads\\mkomani_parsed.json';
const WARD_NAME = 'Mkomani';
const OWNER_PERSON_ID = '66666666-0000-4000-8000-000000000007'; // Salim Omar, Mkomani ward coordinator
const ACTOR_PERSON_ID = '66666666-0000-4000-8000-000000000002';
const ACTOR_ROLE = 'campaign_manager';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }
const sql = postgres(url, { max: 1 });
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  const { villages, leaders, sites, issues } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const c = { villages: 0, leaders: 0, sites: 0, issues: 0, skL: 0, skS: 0, skI: 0 };

  await sql.begin(async (sql) => {
    const [ward] = await sql`SELECT id FROM wards WHERE name = ${WARD_NAME}`;
    if (!ward) throw new Error('Mkomani ward not found');
    const wardId = ward.id;
    const [subRow] = await sql`SELECT id FROM sub_locations WHERE ward_id=${wardId} ORDER BY created_at LIMIT 1`;
    const subId = subRow ? subRow.id : null;

    const ev = await sql`SELECT id, lower(name) n FROM villages WHERE ward_id=${wardId}`;
    const vmap = new Map(ev.map((v) => [v.n, v.id]));
    for (const name of villages) {
      if (vmap.has(norm(name))) continue;
      const [r] = await sql`INSERT INTO villages (ward_id, sub_location_id, name, centroid)
        VALUES (${wardId}, ${subId}, ${name}, (SELECT centroid FROM wards WHERE id=${wardId})) RETURNING id`;
      vmap.set(norm(name), r.id); c.villages++;
    }
    const fallback = vmap.get(norm(WARD_NAME)) || vmap.get(norm('Nyali')) || [...vmap.values()][0];

    // leaders
    const el = await sql`SELECT lower(full_name) n, lower(role_title) r, phone FROM community_leaders WHERE ward_id=${wardId}`;
    const lkey = new Set(el.map((x) => `${x.n}|${x.r}`));
    const lph = new Set(el.filter((x) => x.phone).map((x) => x.phone));
    for (const l of leaders) {
      const vid = vmap.get(norm(l.village)) || fallback;
      const k = `${norm(l.fullName)}|${norm(l.roleTitle)}`;
      if (lkey.has(k) || (l.phone && lph.has(l.phone))) { c.skL++; continue; }
      lkey.add(k); if (l.phone) lph.add(l.phone);
      await sql`INSERT INTO community_leaders (full_name, phone, role_title, village_id, ward_id, owned_by_person_id, sensitive_notes)
        VALUES (${l.fullName}, ${l.phone || null}, ${l.roleTitle}, ${vid}, ${wardId}, ${OWNER_PERSON_ID},
                ${'Imported from Mkomani coordinator records.'})`;
      c.leaders++;
    }

    // sites (dedupe vs existing ward sites: exact-name only to avoid false positives)
    const es = await sql`SELECT lower(name) n FROM community_sites WHERE ward_id=${wardId}`;
    const sset = new Set(es.map((x) => x.n));
    for (const s of sites) {
      if (sset.has(norm(s.name))) { c.skS++; continue; }
      sset.add(norm(s.name));
      const vname = s.villageName || s.areaName;
      const vid = vname ? (vmap.get(norm(vname)) || null) : null;
      await sql`INSERT INTO community_sites
        (type, name, location, ward_id, village_id, area_name, estimated_size,
         contact_person_name, contact_role, contact_phone, visited, visited_at, visit_notes)
        VALUES (${s.type}, ${s.name}, (SELECT centroid FROM wards WHERE id=${wardId}), ${wardId},
                ${vid}, ${s.areaName || null}, ${s.estimatedSize ?? null},
                ${s.contactPersonName || null}, ${s.contactRole || null}, ${s.contactPhone || null},
                ${!!s.visited}, ${s.visited ? sql`now()` : null},
                ${s.visited ? 'Recorded as visited in Mkomani coordinator ground-mapping records.' : null})`;
      c.sites++;
    }

    // village issues
    const ei = await sql`SELECT lower(title) t FROM village_issues WHERE ward_id=${wardId}`;
    const iset = new Set(ei.map((x) => x.t));
    for (const it of issues) {
      const vid = vmap.get(norm(it.villageName)) || fallback;
      if (iset.has(norm(it.title))) { c.skI++; continue; }
      iset.add(norm(it.title));
      await sql`INSERT INTO village_issues (village_id, ward_id, category, title, description, severity, status, verified, reported_by_person_id)
        VALUES (${vid}, ${wardId}, ${it.category}, ${it.title}, ${it.description || null}, ${it.severity}, 'reported', false, ${OWNER_PERSON_ID})`;
      c.issues++;
    }

    const ctx = { source: 'coordinator_file_import', ward: WARD_NAME, files: ['stages.pdf', 'inline Mkomani churches/leaders/challenges'] };
    for (const [action, et, payload] of [
      ['IMPORT_COMMUNITY_LEADERS', 'community_leader', { inserted: c.leaders, skipped: c.skL, villagesCreated: c.villages }],
      ['IMPORT_SITES', 'community_site', { inserted: c.sites, skipped: c.skS }],
      ['IMPORT_VILLAGE_ISSUES', 'village_issue', { inserted: c.issues, skipped: c.skI }],
    ]) {
      await sql`INSERT INTO audit_log (actor_person_id, actor_role, action, entity_type, after_value, context)
        VALUES (${ACTOR_PERSON_ID}, ${ACTOR_ROLE}, ${action}, ${et}, ${sql.json(payload)}, ${sql.json(ctx)})`;
    }
  });
  console.log('Mkomani import complete:', c);
}
main().then(() => sql.end()).catch((e) => { console.error('Import failed:', e); sql.end(); process.exit(1); });
