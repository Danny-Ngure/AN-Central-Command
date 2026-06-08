// One-off importer for the Kadzandani coordinator records:
//   - PDF "Village Elders in Kadzandani Ward Area" (27)
//   - Excel M'Bungoni sub-location: Village Elders (23) + Nyumba Kumi (108)
//   - Excel Boda stages (3) + visited churches/mosques (5)
//
// Mirrors packages/db/src/seed/index.ts conventions. Idempotent: re-runs skip
// rows that already exist (matched on natural keys). Run as the DB owner (alfayo)
// which bypasses RLS, same as the seed.
//
//   node tools/import-kadzandani-details.cjs
//
const fs = require('node:fs');
const path = require('node:path');
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const DATA = process.env.KADZ_JSON || 'C:\\Users\\User\\Downloads\\kadzandani_parsed.json';
const OWNER_PERSON_ID = '66666666-0000-4000-8000-000000000005'; // Peter Mwangi, Kadzandani ward coordinator
const ACTOR_PERSON_ID = '66666666-0000-4000-8000-000000000002'; // Sarah Manager (campaign_manager) — import actor
const ACTOR_ROLE = 'campaign_manager';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }
const sql = postgres(url, { max: 1 });

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  const { leaders, sites, villages } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const counts = { villages: 0, leaders: 0, sites: 0, skippedLeaders: 0, skippedSites: 0 };

  await sql.begin(async (sql) => {
    // ---- resolve ward + sub-locations ----
    const [ward] = await sql`SELECT id FROM wards WHERE name = 'Kadzandani'`;
    if (!ward) throw new Error('Kadzandani ward not found — is the DB seeded?');
    const wardId = ward.id;

    const [kadSub] = await sql`
      SELECT id FROM sub_locations WHERE ward_id = ${wardId} AND lower(name) = 'kadzandani' LIMIT 1`;
    const kadSubId = kadSub ? kadSub.id : null;

    let [mbSub] = await sql`
      SELECT id FROM sub_locations WHERE ward_id = ${wardId} AND lower(name) = ${norm("M'Bungoni")} LIMIT 1`;
    if (!mbSub) {
      [mbSub] = await sql`
        INSERT INTO sub_locations (ward_id, name, centroid)
        VALUES (${wardId}, ${"M'Bungoni"}, (SELECT centroid FROM wards WHERE id = ${wardId}))
        RETURNING id`;
      console.log("  + sub-location: M'Bungoni");
    }
    const mbSubId = mbSub.id;

    // ---- villages (one per coordinator zone) ----
    const existingV = await sql`SELECT id, lower(name) AS n FROM villages WHERE ward_id = ${wardId}`;
    const vmap = new Map(existingV.map((v) => [v.n, v.id]));
    for (const name of villages) {
      const key = norm(name);
      if (vmap.has(key)) continue;
      const subId = key === norm("M'Bungoni") ? mbSubId : kadSubId;
      const [row] = await sql`
        INSERT INTO villages (ward_id, sub_location_id, name, centroid)
        VALUES (${wardId}, ${subId}, ${name}, (SELECT centroid FROM wards WHERE id = ${wardId}))
        RETURNING id`;
      vmap.set(key, row.id);
      counts.villages++;
    }

    // ---- community leaders ----
    const existingL = await sql`
      SELECT lower(full_name) AS n, lower(role_title) AS r FROM community_leaders WHERE ward_id = ${wardId}`;
    const lset = new Set(existingL.map((x) => `${x.n}|${x.r}`));
    for (const l of leaders) {
      const villageId = vmap.get(norm(l.village));
      if (!villageId) { console.warn('  ! no village for', l.fullName, l.village); continue; }
      const k = `${norm(l.fullName)}|${norm(l.roleTitle)}`;
      if (lset.has(k)) { counts.skippedLeaders++; continue; }
      lset.add(k);
      const notes = l.idNumber
        ? `National ID: ${l.idNumber} — imported from Kadzandani coordinator records.`
        : 'Imported from Kadzandani coordinator records.';
      await sql`
        INSERT INTO community_leaders
          (full_name, phone, role_title, village_id, ward_id, owned_by_person_id, sensitive_notes)
        VALUES
          (${l.fullName}, ${l.phone || null}, ${l.roleTitle}, ${villageId}, ${wardId},
           ${OWNER_PERSON_ID}, ${notes})`;
      counts.leaders++;
    }

    // ---- community sites (dedupe vs existing Kadzandani sites, incl. fuzzy) ----
    const existingS = await sql`SELECT lower(name) AS n FROM community_sites WHERE ward_id = ${wardId}`;
    const snames = existingS.map((x) => x.n);
    const isDup = (name) => {
      const n = norm(name);
      return snames.some((e) => e === n || e.includes(n) || n.includes(e));
    };
    for (const s of sites) {
      if (isDup(s.name)) { counts.skippedSites++; console.log('  ~ skip dup site:', s.name); continue; }
      snames.push(norm(s.name));
      const villageId = vmap.get(norm("M'Bungoni")) || null;
      await sql`
        INSERT INTO community_sites
          (type, name, location, ward_id, village_id, area_name,
           contact_person_name, contact_role, contact_phone, visited, visited_at, visit_notes)
        VALUES
          (${s.type}, ${s.name}, (SELECT centroid FROM wards WHERE id = ${wardId}), ${wardId},
           ${s.type === 'boda_stage' ? villageId : null},
           ${s.areaName || null}, ${s.contactPersonName || null}, ${s.contactRole || null},
           ${s.contactPhone || null}, ${!!s.visited}, ${s.visited ? sql`now()` : null},
           ${s.visited ? 'Recorded as visited in Kadzandani coordinator ground-mapping records.' : null})`;
      counts.sites++;
    }

    // ---- audit summary rows ----
    const ctx = { source: 'coordinator_file_import', files: ['KADZANDANI DETAILS.xlsx', 'Kadzandani (2).pdf'] };
    await sql`INSERT INTO audit_log (actor_person_id, actor_role, action, entity_type, after_value, context)
      VALUES (${ACTOR_PERSON_ID}, ${ACTOR_ROLE}, 'IMPORT_COMMUNITY_LEADERS', 'community_leader',
        ${sql.json({ inserted: counts.leaders, skipped: counts.skippedLeaders, villagesCreated: counts.villages })}, ${sql.json(ctx)})`;
    await sql`INSERT INTO audit_log (actor_person_id, actor_role, action, entity_type, after_value, context)
      VALUES (${ACTOR_PERSON_ID}, ${ACTOR_ROLE}, 'IMPORT_SITES', 'community_site',
        ${sql.json({ inserted: counts.sites, skipped: counts.skippedSites })}, ${sql.json(ctx)})`;
  });

  console.log('\nImport complete:', counts);
}

main().then(() => sql.end()).catch((e) => { console.error('\nImport failed:', e); sql.end(); process.exit(1); });
