// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { authCredentials, db, people } from '@an/db';
import { eq, ilike } from 'drizzle-orm';
import { hashDefaultPassword } from '../passwords';
import { getRedis } from '../redis';

// Sets working logins for the "view everything" tier — department heads, ward reps
// and assistants — so they can actually sign in. For each person it:
//   • sets their real phone (07… format; login also accepts +254…/254…),
//   • makes the account active,
//   • sets password to devpassword123! (they change it at /account/password),
//   • clears any lockout.
//
//   node <tsx> packages/auth/src/dev/set-team-logins.ts
//
// Password is uniform (devpassword123!) because we don't hold these members'
// National IDs. Re-run any time; it upserts.

const PASSWORD = 'devpassword123!';

// name = current full name; alt = fallback spelling seen in older seeds.
const TEAM: { name: string; alt?: string; phone: string }[] = [
  // Department heads
  { name: 'Justine Katana', phone: '0713168440' },
  { name: 'Cavins Omino',   phone: '0735683447' },
  { name: 'Arnold Baya',    phone: '0706547972' },
  { name: 'Javas Tindi',    phone: '0740553475' },
  { name: 'Ryan Siriba',    phone: '0702884715' },
  // Ward representatives
  { name: 'Nafisa Kalondu', phone: '0113254609' },
  { name: 'Kofa Mohammed',  phone: '0712838800' },
  { name: 'Taura',          phone: '0723922193' },
  { name: 'Lucy Ogutu',     phone: '0702816974' },
  { name: 'Salma Khalef',   phone: '0779531936' },
  // Ward assistants
  { name: 'Wadede Hamisi',  phone: '0726790872' },
  { name: 'Umi Njeri',      phone: '0724638705' },
  { name: 'Damah',          phone: '0724976672' },
  { name: 'Sammy Otenga',   alt: 'Sammy Otega',  phone: '0703754630' },
  { name: 'Jilo Mohammed',  alt: 'Jilo Bakari',  phone: '0727515280' },
];

async function findPerson(name: string, alt?: string): Promise<string | null> {
  for (const n of [name, alt].filter(Boolean) as string[]) {
    const rows = await db.select({ id: people.id }).from(people).where(eq(people.fullName, n)).limit(1);
    if (rows.length > 0) return rows[0]!.id;
  }
  // Fallback: match on the first name token (handles minor spelling drift).
  const token = name.split(' ')[0];
  const rows = await db.select({ id: people.id }).from(people).where(ilike(people.fullName, `${token}%`)).limit(1);
  return rows[0]?.id ?? null;
}

async function main() {
  const redis = getRedis();
  const hashed = await hashDefaultPassword(PASSWORD);

  for (const t of TEAM) {
    try {
      const pid = await findPerson(t.name, t.alt);
      if (!pid) {
        console.log(`  ✗ ${t.name} — not found in people`);
        continue;
      }

      // Set their real phone — unless another record already owns it (the same
      // person appears in two rosters, e.g. a ward rep who is also a Flames member).
      // In that case leave the phone alone and just make sure they have a password.
      const clash = await db.select({ id: people.id }).from(people).where(eq(people.phone, t.phone)).limit(1);
      if (clash.length > 0 && clash[0]!.id !== pid) {
        console.log(`  ! ${t.name}: phone ${t.phone} already belongs to another record — password set, phone left as-is`);
        await db.update(people).set({ active: true, deletedAt: null }).where(eq(people.id, pid));
      } else {
        await db.update(people).set({ phone: t.phone, active: true, deletedAt: null }).where(eq(people.id, pid));
      }

      const cred = await db.select({ id: authCredentials.id }).from(authCredentials).where(eq(authCredentials.personId, pid)).limit(1);
      if (cred.length > 0) {
        await db
          .update(authCredentials)
          .set({ passwordHash: hashed, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
          .where(eq(authCredentials.personId, pid));
      } else {
        await db.insert(authCredentials).values({ personId: pid, passwordHash: hashed, mustChangePassword: true });
      }

      await redis.del(`auth:attempts:${t.phone}`, `auth:lockout:${t.phone}`);
      console.log(`  ✓ ${t.name}: login "${t.phone}"  password "${PASSWORD}"`);
    } catch (e) {
      console.log(`  ✗ ${t.name}: skipped (${(e as Error).message})`);
    }
  }

  await redis.quit();
  console.log('\nDone. All view-all team members can sign in with their phone + devpassword123!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to set team logins:', err);
    process.exit(1);
  });
