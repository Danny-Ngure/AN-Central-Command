// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authCredentials, db, people, wards } from '@an/db';
import { eq, isNull } from 'drizzle-orm';
import { hashDefaultPassword } from '../passwords';
import { getRedis } from '../redis';

// ONE-AND-DONE: makes EVERY person in the campaign able to sign in — the ward
// field teams, all Warembo wa Alfayo members, and the Alfayo Flames crew — on top
// of the leadership already handled by set:admins / set:team.
//
//   node <tsx> packages/auth/src/dev/provision-all-logins.ts
//
// For each roster member it:
//   • ensures a person row exists (matched by name first, else by phone; new
//     members are added as ward-scoped `canvasser`s — they see only their ward),
//   • never downgrades or re-passwords anyone who already has an account,
//   • gives brand-new members a login: password = their National ID if we have it,
//     otherwise devpassword123! (they change it at /account/password).
// Finally it sweeps the whole people table and gives a login to anyone still
// missing one. Existing passwords are never overwritten.
//
// Login accepts 07…, +254…, or 254… — members type their own phone.

const FALLBACK = 'devpassword123!';

type Member = { name: string; id?: string | null; phone?: string | null; ward?: string | null; title?: string | null };
type Roster = { ward_teams: Member[]; warembo: Member[]; flames: Member[] };

const __dirname = dirname(fileURLToPath(import.meta.url));
const roster: Roster = JSON.parse(readFileSync(resolve(__dirname, 'roster-data.json'), 'utf-8'));

function localPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let core = digits;
  if (core.startsWith('254')) core = core.slice(3);
  else if (core.startsWith('0')) core = core.slice(1);
  if (!/^[17]\d{8}$/.test(core)) return null;
  return `0${core}`;
}

async function main() {
  const redis = getRedis();

  // Ward name (with or without " Ward") → id.
  const wardRows = await db.select({ id: wards.id, name: wards.name }).from(wards);
  const wardId = (name?: string | null): string | null => {
    if (!name) return null;
    const key = name.replace(/\s+ward$/i, '').trim().toLowerCase();
    return wardRows.find((w) => w.name.replace(/\s+ward$/i, '').trim().toLowerCase() === key)?.id ?? null;
  };

  // Cache password hashes so we only run Argon2 once per distinct password.
  const hashCache = new Map<string, string>();
  const hashOf = async (pw: string): Promise<string> => {
    let h = hashCache.get(pw);
    if (!h) { h = await hashDefaultPassword(pw); hashCache.set(pw, h); }
    return h;
  };

  const groups: { label: string; rows: Member[] }[] = [
    { label: 'Ward teams', rows: roster.ward_teams },
    { label: 'Warembo wa Alfayo', rows: roster.warembo },
    { label: 'Alfayo Flames', rows: roster.flames },
  ];

  let added = 0, linked = 0, noPhone = 0;
  const skipped: string[] = [];

  let phoneClash = 0;
  for (const g of groups) {
    for (const m of g.rows) {
      try {
        const phone = m.phone ? localPhone(m.phone) : null;
        if (!phone) { noPhone++; skipped.push(`${m.name} (${g.label})`); continue; }

        // Does another record already own this phone? (Same person in two rosters.)
        const owner = await db.select({ id: people.id }).from(people).where(eq(people.phone, phone)).limit(1);

        // 1) Match an existing person by exact name (keeps leaders' roles intact).
        let pid: string | null = null;
        const byName = await db.select({ id: people.id }).from(people).where(eq(people.fullName, m.name)).limit(1);
        if (byName.length > 0) {
          pid = byName[0]!.id;
          if (owner.length > 0 && owner[0]!.id !== pid) {
            // Phone belongs to a different record — don't move it, just keep them active.
            await db.update(people).set({ active: true, deletedAt: null }).where(eq(people.id, pid));
            phoneClash++;
          } else {
            await db.update(people).set({ phone, active: true, deletedAt: null }).where(eq(people.id, pid));
          }
          linked++;
        } else if (owner.length > 0) {
          // Nobody by this name, but the phone already exists → adopt that row.
          pid = owner[0]!.id;
          await db.update(people).set({ active: true }).where(eq(people.id, pid));
          linked++;
        } else {
          // 2) Brand-new member — add as a ward-scoped canvasser.
          const ins = await db
            .insert(people)
            .values({ phone, fullName: m.name, role: 'canvasser', wardId: wardId(m.ward), nationalId: m.id ?? null, active: true, title: g.label })
            .returning({ id: people.id });
          pid = ins[0]!.id;
          added++;
        }

        // 3) Create a login only if they don't already have one (never overwrite).
        const pw = (m.id ?? '').trim() || FALLBACK;
        await db
          .insert(authCredentials)
          .values({ personId: pid, passwordHash: await hashOf(pw), mustChangePassword: true })
          .onConflictDoNothing();

        await redis.del(`auth:attempts:${phone}`, `auth:lockout:${phone}`);
      } catch (e) {
        skipped.push(`${m.name} (${g.label}) — error: ${(e as Error).message}`);
      }
    }
  }
  if (phoneClash > 0) console.log(`  (${phoneClash} members share a phone with another record — left their phone as-is)`);

  // 4) Safety sweep — anyone in the table still without a login gets devpassword123!.
  const missing = await db
    .select({ id: people.id })
    .from(people)
    .leftJoin(authCredentials, eq(authCredentials.personId, people.id))
    .where(isNull(authCredentials.id));
  let swept = 0;
  for (const p of missing) {
    await db.insert(authCredentials).values({ personId: p.id, passwordHash: await hashOf(FALLBACK), mustChangePassword: true }).onConflictDoNothing();
    swept++;
  }

  await redis.quit();
  console.log(`\nDone.`);
  console.log(`  New members added:      ${added}`);
  console.log(`  Existing members linked: ${linked}`);
  console.log(`  Extra logins swept:     ${swept}`);
  console.log(`  Skipped (no phone):     ${noPhone}`);
  if (skipped.length > 0) {
    console.log(`\n  These members have no phone on file, so no login was created:`);
    for (const s of skipped) console.log(`    - ${s}`);
    console.log(`  Add a phone for them and re-run to enable their login.`);
  }
  console.log(`\n  Everyone with a phone can now sign in. Default password is their`);
  console.log(`  National ID where known, otherwise "${FALLBACK}". They change it at /account/password.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to provision logins:', err);
    process.exit(1);
  });
