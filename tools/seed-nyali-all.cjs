// One command to load ALL the Nyali datasets built in this session into the DB.
//
//   node tools/seed-nyali-all.cjs
//
// Runs each seed in order. Every seed is idempotent, so this is safe to re-run.
// Requires the app DB to be up (docker compose -f infra/docker-compose.yml up -d)
// and apps/web/.env.local to have DATABASE_URL.

const { execSync } = require('child_process');
const path = require('path');

const SCRIPTS = [
  'seed-nyali-polling-centres.cjs', // 30 polling centres (reconciled)
  'seed-nyali-churches.cjs',        // 15 churches -> wards + villages
];

for (const s of SCRIPTS) {
  console.log(`\n▶ ${s}`);
  execSync(`node "${path.join(__dirname, s)}"`, { stdio: 'inherit' });
}
console.log('\n✓ All Nyali seeds complete. Reload the app to see the data.');
