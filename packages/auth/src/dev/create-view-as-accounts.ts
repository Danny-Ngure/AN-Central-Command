// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { authCredentials, db, people, wards } from '@an/db';
import { eq, ilike } from 'drizzle-orm';
import { hashDefaultPassword } from '../passwords';

// "View-as" preview accounts for Dan Ngure (system auditor) so he can log in and
// see EXACTLY what an ordinary member of each ward / group sees. Each account is a
// plain member (role `canvasser`) scoped to one ward — the same limited view a
// regular field member has.
//
//   node <tsx> packages/auth/src/dev/create-view-as-accounts.ts
//
// Distinct logins (type them straight into the phone box — login accepts letters):
//   VIEWFRT / VIEWKAD / VIEWKON / VIEWMKM / VIEWZIW / VIEWWAREMBO / VIEWFLAMES
// Password = same as the login. These are clearly named "View-As: …" in the
// directory and can be deleted any time once previewing is done.

type Acct = { login: string; label: string; wardName: string | null };

const ACCOUNTS: Acct[] = [
  { login: 'VIEWFRT',     label: 'View-As: Frere Town',      wardName: 'Frere Town' },
  { login: 'VIEWKAD',     label: 'View-As: Kadzandani',      wardName: 'Kadzandani' },
  { login: 'VIEWKON',     label: 'View-As: Kongowea',        wardName: 'Kongowea' },
  { login: 'VIEWMKM',     label: 'View-As: Mkomani',         wardName: 'Mkomani' },
  { login: 'VIEWZIW',     label: "View-As: Ziwa La Ng'ombe", wardName: "Ziwa La Ng'ombe" },
  { login: 'VIEWWAREMBO', label: 'View-As: Warembo',         wardName: null },
  { login: 'VIEWFLAMES',  label: 'View-As: Alfayo Flames',   wardName: null },
];

async function findWardId(name: string): Promise<string | null> {
  let rows = await db.select({ id: wards.id }).from(wards).where(eq(wards.name, name)).limit(1);
  if (rows.length === 0) {
    // Tolerate "Ward" suffix / spelling drift.
    const token = name.split(' ')[0];
    rows = await db.select({ id: wards.id }).from(wards).where(ilike(wards.name, `%${token}%`)).limit(1);
  }
  return rows[0]?.id ?? null;
}

async function main() {
  for (const a of ACCOUNTS) {
    const wardId = a.wardName ? await findWardId(a.wardName) : null;
    if (a.wardName && !wardId) {
      console.log(`  ✗ ${a.label}: ward "${a.wardName}" not found — skipped`);
      continue;
    }

    // Upsert the person by the stable login (stored in the phone column).
    const existing = await db.select({ id: people.id }).from(people).where(eq(people.phone, a.login)).limit(1);
    let pid: string;
    if (existing.length > 0) {
      pid = existing[0]!.id;
      await db
        .update(people)
        .set({ fullName: a.label, role: 'canvasser', wardId, active: true, deletedAt: null, title: 'Preview account' })
        .where(eq(people.id, pid));
    } else {
      const inserted = await db
        .insert(people)
        .values({ phone: a.login, fullName: a.label, role: 'canvasser', wardId, active: true, title: 'Preview account' })
        .returning({ id: people.id });
      pid = inserted[0]!.id;
    }

    // Password = the login string.
    const hashed = await hashDefaultPassword(a.login);
    const cred = await db.select({ id: authCredentials.id }).from(authCredentials).where(eq(authCredentials.personId, pid)).limit(1);
    if (cred.length > 0) {
      await db
        .update(authCredentials)
        .set({ passwordHash: hashed, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(authCredentials.personId, pid));
    } else {
      await db.insert(authCredentials).values({ personId: pid, passwordHash: hashed, mustChangePassword: false });
    }

    console.log(`  ✓ ${a.label}: login "${a.login}"  password "${a.login}"${wardId ? '' : '  (constituency-wide)'}`);
  }
  console.log('\nDone. Dan can sign out and log in as any of these to preview that group\'s view.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to create view-as accounts:', err);
    process.exit(1);
  });
