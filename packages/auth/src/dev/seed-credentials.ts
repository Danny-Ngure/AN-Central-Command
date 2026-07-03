// IMPORTANT: env-bootstrap must be the first import so dotenv runs BEFORE @an/db's
// client.ts is evaluated (which reads process.env.DATABASE_URL at module init).
import './env-bootstrap';

import { authCredentials, db, people } from '@an/db';
import { eq } from 'drizzle-orm';
import { hashDefaultPassword } from '../passwords';

// Seed script — gives every person without credentials a DEFAULT password equal to
// their National ID number. They then change it via /account/password (which enforces
// the 12-char minimum). People with no National ID on file fall back to a dev password.
//
// National IDs are short (7–8 digits), so we hash them with hashDefaultPassword, which
// skips the BR-001.1 length check that only applies to user-chosen passwords.

const FALLBACK_PASSWORD = 'devpassword123!';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run dev seed in production.');
    process.exit(1);
  }

  console.log('Seeding auth_credentials (default password = National ID)...');

  const allPeople = await db
    .select({ id: people.id, fullName: people.fullName, role: people.role, nationalId: people.nationalId })
    .from(people);

  let inserted = 0;
  let skipped = 0;
  let fallback = 0;
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
    const nid = (p.nationalId ?? '').trim();
    const rawDefault = nid.length > 0 ? nid : FALLBACK_PASSWORD;
    if (nid.length === 0) fallback += 1;
    const hashed = await hashDefaultPassword(rawDefault);
    await db.insert(authCredentials).values({
      personId: p.id,
      passwordHash: hashed,
      // On a default (National ID) password, nudge the user to change it.
      mustChangePassword: true,
      // TOTP not enrolled. login() will return AUTH_2FA_NOT_ENROLLED for roles that
      // require 2FA — that's correct behavior; production wires an enrollment flow.
    });
    inserted += 1;
    console.log(`  ✓ ${p.fullName} (${p.role}) — default = ${nid.length > 0 ? 'National ID' : 'fallback password'}`);
  }

  console.log(`\nDone. ${inserted} credentials inserted, ${skipped} skipped, ${fallback} used the fallback (no National ID).`);
  console.log(`Everyone's default password is their National ID number; ${fallback} without an ID use "${FALLBACK_PASSWORD}".`);
  console.log('Users change it at /account/password (min 12 characters).');
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
