// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { authCredentials, db, people } from '@an/db';
import { eq } from 'drizzle-orm';
import { hashDefaultPassword } from '../passwords';
import { getRedis } from '../redis';

// Sets concrete login details for the four Super Admins, updates their phone /
// National ID, gives them a password, and clears any lockout so they can sign in.
//
//   node <tsx> packages/auth/src/dev/set-admin-logins.ts
//
// NOTE: Alfayo Nelson's National ID isn't in our data — his password is TEMPORARILY
// set to his phone number. Replace ALFAYO below with his real ID and re-run.

// Phones stored in local 07… format (login accepts any format — see phoneVariants
// in login.ts — so users can type 07…, +254…, or 254…).
//
// `role` is optional. It's only set for Irene, to elevate her from `comms_head`
// (which the RLS policies do NOT treat as leadership, so she was starved of data)
// to `chief_strategist` — the same leadership tier as Benson. This gives her full
// access at every layer (nav, data-import, and the database's row-level security)
// so she is equal to Alfayo and Benson. Her org-chart title stays "Head of Media"
// because the Team page labels her by name, not by this enum.
const ADMINS: { name: string; phone: string; nationalId: string | null; password: string; role?: string }[] = [
  { name: 'Dan Ngure',      phone: 'ADMIN001',    nationalId: null,       password: 'ADMIN001' },
  { name: 'Benson Imoli',   phone: '0725967858',  nationalId: '29580321', password: '29580321' },
  { name: 'Irene Mkamburi', phone: '0715562217',  nationalId: '38583776', password: '38583776', role: 'chief_strategist' },
  // Alfayo's ID is unknown → password temporarily = his phone number. Update when known.
  { name: 'Alfayo Nelson',  phone: '0743327286',  nationalId: null,       password: '0743327286' },
];

async function main() {
  const redis = getRedis();
  for (const a of ADMINS) {
    const rows = await db.select({ id: people.id }).from(people).where(eq(people.fullName, a.name)).limit(1);
    if (rows.length === 0) {
      console.log(`  ✗ ${a.name} — not found in people`);
      continue;
    }
    const pid = rows[0]!.id;

    // Also force the account active + un-deleted so login's active filter can't
    // silently reject them (a deactivated row is the usual cause of "incorrect").
    const set: Record<string, unknown> = { phone: a.phone, active: true, deletedAt: null };
    if (a.nationalId) set.nationalId = a.nationalId;
    if (a.role) set.role = a.role; // elevate to a leadership role (Irene only)
    await db.update(people).set(set).where(eq(people.id, pid));

    const hashed = await hashDefaultPassword(a.password);
    const existing = await db.select({ id: authCredentials.id }).from(authCredentials).where(eq(authCredentials.personId, pid)).limit(1);
    if (existing.length > 0) {
      await db
        .update(authCredentials)
        .set({ passwordHash: hashed, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(authCredentials.personId, pid));
    } else {
      await db.insert(authCredentials).values({ personId: pid, passwordHash: hashed, mustChangePassword: false });
    }

    // Clear any lockout on this login identifier.
    await redis.del(`auth:attempts:${a.phone}`, `auth:lockout:${a.phone}`);
    const roleNote = a.role ? `  role → ${a.role}` : '';
    console.log(`  ✓ ${a.name}: login "${a.phone}"  password "${a.password}"${roleNote}`);
  }
  await redis.quit();
  console.log('\nDone. Admin logins set (Alfayo uses a temporary password until his ID is provided).');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to set admin logins:', err);
    process.exit(1);
  });
