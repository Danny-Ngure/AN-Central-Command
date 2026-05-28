// IMPORTANT: env-bootstrap must be the first import so dotenv runs BEFORE @an/db's
// client.ts is evaluated (which reads process.env.DATABASE_URL at module init).
import './env-bootstrap';

import { authCredentials, db, people } from '@an/db';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../passwords';

// Dev-only seed script — gives every seeded person a known password so the login
// flow can be exercised end-to-end via curl / Playwright.
//
// Default password: "devpassword123!" (15 chars, meets BR-001.1 complexity).
// DO NOT RUN IN ANY ENVIRONMENT THAT HOLDS REAL DATA.

const DEV_PASSWORD = 'devpassword123!';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run dev seed in production.');
    process.exit(1);
  }

  console.log('Seeding auth_credentials for all dev people...');
  const hashed = await hashPassword(DEV_PASSWORD);

  const allPeople = await db.select({ id: people.id, fullName: people.fullName, role: people.role }).from(people);

  let inserted = 0;
  let skipped = 0;
  for (const p of allPeople) {
    const existing = await db
      .select({ id: authCredentials.id })
      .from(authCredentials)
      .where(eq(authCredentials.personId, p.id))
      .limit(1);
    if (existing.length > 0) {
      skipped += 1;
      continue;
    }
    await db.insert(authCredentials).values({
      personId: p.id,
      passwordHash: hashed,
      // TOTP not enrolled. login() will return AUTH_2FA_NOT_ENROLLED for roles that
      // require 2FA — that's correct behavior; production wires an enrollment flow.
    });
    inserted += 1;
    console.log(`  ✓ ${p.fullName} (${p.role})`);
  }

  console.log(`\nDone. ${inserted} credentials inserted, ${skipped} skipped (already existed).`);
  console.log(`\nLogin for everyone is password "${DEV_PASSWORD}".`);
  console.log('Example:');
  console.log(`  curl -X POST http://localhost:3000/api/auth/login \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '{"phoneOrEmail":"+254700000002","password":"${DEV_PASSWORD}","client":"mobile"}'`);
  console.log('');
  console.log('  Note: roles requiring 2FA (campaign_manager, ward_coordinator, etc.) will');
  console.log('  return AUTH_2FA_NOT_ENROLLED until TOTP enrollment is added. Use the');
  console.log('  canvasser (+254700000010) or polling_agent (+254700000011) to test the full');
  console.log('  success path without 2FA.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to seed credentials:', err);
    process.exit(1);
  });
