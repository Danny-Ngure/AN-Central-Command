// Seed the Nyali bodaboda stages (from tools/data/nyali-boda-stages.json, produced
// by extract-boda-stages.py) into community_sites as type 'boda_stage', with the
// ward taken from the PDF colour-coding and member count stored in estimated_size.
//
//   python tools/extract-boda-stages.py "<pdf>"   # regenerate the JSON
//   node tools/seed-boda-stages.cjs
//
// Upsert by (ward, name-key) against a snapshot of pre-existing boda stages, so
// VISITED stages keep their visit data. Stale boda stages that are unvisited,
// unplanned and unmatched by the list are soft-deleted (de-duplication).

const fs = require('fs');
const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

const WARDS = {
  ziwa: '22222222-0000-4000-8000-000000000005',
  mkomani: '22222222-0000-4000-8000-000000000003',
  kongowea: '22222222-0000-4000-8000-000000000002',
  kadzandani: '22222222-0000-4000-8000-000000000001',
  freretown: '22222222-0000-4000-8000-000000000004',
};

const STAGES = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'nyali-boda-stages.json'), 'utf8'));

const tight = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const stageKey = (s) => (s || '').toLowerCase().replace(/\b(bodaboda|boda|stage)\b/g, '').replace(/[^a-z0-9]/g, '');

async function main() {
  // Villages per ward for trickle-down linking.
  const villageRows = await sql`SELECT id, name, ward_id AS "wardId" FROM villages WHERE deleted_at IS NULL`;
  const villagesByWard = new Map();
  for (const v of villageRows) {
    if (!villagesByWard.has(v.wardId)) villagesByWard.set(v.wardId, []);
    villagesByWard.get(v.wardId).push({ ...v, t: tight(v.name) });
  }
  const matchVillage = (wardId, name) => {
    const t = tight(name);
    const vs = villagesByWard.get(wardId) || [];
    const hit = vs.filter((v) => v.t.length >= 4 && t.includes(v.t)).sort((a, b) => b.t.length - a.t.length)[0];
    return hit ? { id: hit.id, name: hit.name } : null;
  };

  // Snapshot existing boda stages (match targets; preserve visited ones).
  const snapshot = (await sql`
    SELECT id, ward_id AS "wardId", name, visited, planned_visit_at AS "plannedVisitAt", visit_notes AS "visitNotes"
    FROM community_sites WHERE type = 'boda_stage' AND deleted_at IS NULL
  `).map((r) => ({ ...r, key: stageKey(r.name) }));
  const matched = new Set();

  let inserted = 0, updated = 0;
  for (const st of STAGES) {
    const wardId = WARDS[st.ward];
    if (!wardId) continue;
    const key = stageKey(st.name);
    const v = matchVillage(wardId, st.name);
    const cand = snapshot.find((r) => r.wardId === wardId && r.key === key && !matched.has(r.id));
    if (cand) {
      await sql`
        UPDATE community_sites
        SET estimated_size = ${st.members},
            village_id = COALESCE(village_id, ${v ? v.id : null}),
            area_name = COALESCE(NULLIF(area_name, ''), ${v ? v.name : null}),
            updated_at = now()
        WHERE id = ${cand.id}`;
      matched.add(cand.id);
      updated++;
    } else {
      await sql`
        INSERT INTO community_sites (type, name, location, ward_id, estimated_size, village_id, area_name)
        VALUES ('boda_stage', ${st.name}, (SELECT centroid FROM wards WHERE id = ${wardId}::uuid),
                ${wardId}, ${st.members}, ${v ? v.id : null}, ${v ? v.name : null})`;
      inserted++;
    }
  }

  // Retire stale boda stages: not in the list, never visited, no plan/notes.
  let retired = 0;
  for (const r of snapshot) {
    if (matched.has(r.id)) continue;
    if (r.visited || r.plannedVisitAt || r.visitNotes) continue; // keep fieldwork
    await sql`UPDATE community_sites SET deleted_at = now() WHERE id = ${r.id}`;
    retired++;
  }

  console.log(`✓ Boda stages: ${inserted} inserted, ${updated} updated (kept visit data), ${retired} stale unvisited retired.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
