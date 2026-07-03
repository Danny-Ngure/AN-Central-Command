// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { authCredentials, db, people } from '@an/db';
import { and, eq, isNull } from 'drizzle-orm';
import { hashPassword } from '../passwords';

// FORCE-RESET every ACTIVE person's password to ONE shared, known dev password so
// the whole team can log in immediately. Overwrites existing credentials, clears any
// TOTP secret + lockout, and sets must_change_password = false (no change-password
// nag — this is a demo login everyone shares). Inactive/deleted accounts are skipped
// (they can't log in anyway). Pass the password as argv[2] or via SHARED_PASSWORD.
//
//   pnpm --filter @an/auth reset:all -- 'Alfayo2027Win!'
//
// DO NOT RUN IN PRODUCTION.

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run a bulk password reset in production.');
    process.exit(1);
  }

  const password = (process.argv[2] ?? process.env.SHARED_PASSWORD ?? '').trim();
  if (password.length < 12) {
    console.error('Provide a password of at least 12 characters: reset:all -- "<password>"');
    process.exit(1);
  }

  const activePeople = await db
    .select({ id: people.id, fullName: people.fullName, phone: people.phone, role: people.role })
    .from(people)
    .where(and(eq(people.active, true), isNull(people.deletedAt)))
    .orderBy(people.fullName);

  // One hash per user (each gets its own Argon2id salt) — hashed once here, reused
  // is fine too, but per-user salting is cheap and correct.
  let reset = 0;
  let inserted = 0;
  for (const p of activePeople) {
    const hashed = await hashPassword(password);
    const existing = await db
      .select({ id: authCredentials.id })
      .from(authCredentials)
      .where(eq(authCredentials.personId, p.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(authCredentials)
        .set({
          passwordHash: hashed,
          mustChangePassword: false,
          totpSecret: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(authCredentials.personId, p.id));
      reset += 1;
    } else {
      await db.insert(authCredentials).values({
        personId: p.id,
        passwordHash: hashed,
        mustChangePassword: false,
      });
      inserted += 1;
    }
    console.log(`  ✓ ${p.fullName} (${p.role}) — ${p.phone}`);
  }

  console.log(`\nDone. ${reset} reset, ${inserted} newly created. ${activePeople.length} active accounts now share the password.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to reset logins:', err);
    process.exit(1);
  });
