// Give every active member a polling station (where they vote) + agent grounds.
// Creates a voter-roll row per person (matched by phone) linked to a station in
// their ward, round-robin. Skips anyone who already matches a voter. Idempotent.
const path = require('node:path');
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const tail = (s) => String(s || '').replace(/\D/g, '').slice(-9);

async function main() {
  const c = { voters: 0, agentStation: 0, skipped: 0 };
  await sql.begin(async (sql) => {
    const stationsByWard = new Map();
    for (const ps of await sql`SELECT id, name, ward_id FROM polling_stations ORDER BY ward_id, name`) {
      (stationsByWard.get(ps.ward_id) ?? stationsByWard.set(ps.ward_id, []).get(ps.ward_id)).push(ps);
    }
    const people = await sql`
      SELECT id, full_name, phone, national_id, ward_id, team_id, agent_station
      FROM people WHERE active AND deleted_at IS NULL AND ward_id IS NOT NULL
      ORDER BY team_id`;

    const counter = new Map(); // per-ward round-robin index
    for (const p of people) {
      const stations = stationsByWard.get(p.ward_id) ?? [];
      if (stations.length === 0) { c.skipped++; continue; }

      // already matches a voter? reuse that station.
      const t = tail(p.phone);
      const existing = await sql`
        SELECT ps.name FROM voters v LEFT JOIN polling_stations ps ON ps.id = v.polling_station_id
        WHERE v.consent_withdrawn_at IS NULL
          AND ( (${p.national_id ?? ''} <> '' AND v.national_id = ${p.national_id})
                OR (${t} <> '' AND right(regexp_replace(coalesce(v.phone,''),'\\D','','g'),9) = ${t})
                OR lower(v.first_name||' '||v.surname) = lower(${p.full_name}) )
        LIMIT 1`;

      let stationName;
      if (existing.length) {
        stationName = existing[0].name;
      } else {
        const i = (counter.get(p.ward_id) ?? 0) % stations.length;
        counter.set(p.ward_id, (counter.get(p.ward_id) ?? 0) + 1);
        const st = stations[i];
        stationName = st.name;
        const parts = String(p.full_name).trim().split(/\s+/);
        const firstName = parts[0] || p.full_name;
        const surname = parts.slice(1).join(' ') || parts[0];
        await sql`
          INSERT INTO voters (voter_number, first_name, surname, gender, ward_id, polling_station_id, phone, national_id, registration_source)
          VALUES (${'ANHF-' + (p.team_id || p.id)}, ${firstName}, ${surname}, 'U', ${p.ward_id}, ${st.id},
                  ${p.phone}, ${p.national_id || null}, 'iebc_register')
          ON CONFLICT (voter_number) DO UPDATE SET polling_station_id = EXCLUDED.polling_station_id`;
        c.voters++;
      }

      if (!p.agent_station && stationName) {
        await sql`UPDATE people SET agent_station = ${stationName}, updated_at = now() WHERE id = ${p.id}`;
        c.agentStation++;
      }
    }
  });
  console.log('Polling-station assignment:', c);
}
main().then(() => sql.end()).catch((e) => { console.error(e); sql.end(); process.exit(1); });
