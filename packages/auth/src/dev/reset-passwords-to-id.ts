// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { authCredentials, db, people } from '@an/db';
import { eq } from 'drizzle-orm';
import { hashDefaultPassword } from '../passwords';

// FORCE-RESET every person's password to their National ID number (fallback dev
// password when no ID is on file), and flag must_change_password = true so the app
// nudges them to change it. Unlike seed-credentials, this OVERWRITES existing
// credentials. Run when you want to reset everyone to the ID default.
//
//   node <tsx> packages/auth/src/dev/reset-passwords-to-id.ts
//
// DO NOT RUN IN ANY ENVIRONMENT THAT HOLDS REAL DATA without intending to reset it.

const FALLBACK_PASSWORD = 'devpassword123!';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run a password reset in production.');
    process.exit(1);
  }

  console.log('Resetting ALL passwords to National ID (must_change_password = true)...');

  const allPeople = await db
    .select({ id: people.id, fullName: people.fullName, nationalId: people.nationalId })
    .from(people);

  // Special admin: Dan Ngure logs in with PHONE = "ADMIN001" and password = "ADMIN001".
  // Everyone else logs in with their phone (E.164 +254…) and password = National ID.
  const ADMIN_NAME = 'Dan Ngure';
  const ADMIN_LOGIN = 'ADMIN001';

  let reset = 0;
  let fallback = 0;
  for (const p of allPeople) {
    const isAdmin = p.fullName === ADMIN_NAME;
    const nid = (p.nationalId ?? '').trim();
    const rawDefault = isAdmin ? ADMIN_LOGIN : nid.length > 0 ? nid : FALLBACK_PASSWORD;
    if (!isAdmin && nid.length === 0) fallback += 1;
    const hashed = await hashDefaultPassword(rawDefault);
    // The password can be changed by the user; we still flag non-admins so the app
    // shows a gentle "change your default" banner (no hard block).
    const mustChange = !isAdmin;

    // Give Dan the ADMIN001 phone (his login identifier).
    if (isAdmin) {
      await db.update(people).set({ phone: ADMIN_LOGIN }).where(eq(people.id, p.id));
    }

    const existing = await db
      .select({ id: authCredentials.id })
      .from(authCredentials)
      .where(eq(authCredentials.personId, p.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(authCredentials)
        .set({ passwordHash: hashed, mustChangePassword: mustChange, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(authCredentials.personId, p.id));
    } else {
      await db.insert(authCredentials).values({ personId: p.id, passwordHash: hashed, mustChangePassword: mustChange });
    }
    reset += 1;
    console.log(`  ✓ ${p.fullName} — ${isAdmin ? 'ADMIN001 (login + password)' : nid.length > 0 ? 'National ID' : 'fallback'}`);
  }

  console.log(`\nDone. ${reset} passwords reset (${fallback} used the fallback — no National ID).`);
  console.log('Everyone must now change their password at /account/password (min 12 characters).');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to reset passwords:', err);
    process.exit(1);
  });
