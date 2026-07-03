// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { and, eq, inArray } from 'drizzle-orm';
import { db, people } from '@an/db';

// UNDO the bulk Warembo / Flames / ward-team sign-ups created by provision:all.
//
//   node <tsx> packages/auth/src/dev/deprovision-roster-logins.ts
//
// provision:all inserted those members with a group label in their `title`
// ('Warembo wa Alfayo', 'Alfayo Flames', 'Ward teams') and role 'canvasser'. This
// script soft-deletes exactly those inserted rows (sets active = false and
// deleted_at) so they leave the Team Directory and can no longer log in — which
// puts the member counts back where they were and keeps Warembo / Team / Flames as
// separate rosters again.
//
// It is SOFT delete (reversible) and it ONLY touches rows carrying those exact
// group-label titles, so the real leadership, ward reps/assistants, admins, and
// Dan's preview accounts are never affected.

const GROUP_TITLES = ['Warembo wa Alfayo', 'Alfayo Flames', 'Ward teams'];

async function main() {
  const targets = await db
    .select({ id: people.id, name: people.fullName, title: people.title })
    .from(people)
    .where(and(inArray(people.title, GROUP_TITLES), eq(people.role, 'canvasser')));

  if (targets.length === 0) {
    console.log('Nothing to undo — no bulk-provisioned roster accounts found.');
    return;
  }

  const ids = targets.map((t) => t.id);
  await db
    .update(people)
    .set({ active: false, deletedAt: new Date() })
    .where(inArray(people.id, ids));

  const byTitle: Record<string, number> = {};
  for (const t of targets) byTitle[t.title ?? '—'] = (byTitle[t.title ?? '—'] ?? 0) + 1;

  console.log(`Removed ${targets.length} bulk-provisioned accounts from the directory:`);
  for (const [title, n] of Object.entries(byTitle)) console.log(`  ${title}: ${n}`);
  console.log('\nMember counts are back to normal. Warembo / Team / Flames are separate again.');
  console.log('(Soft delete — these rows are hidden, not erased. Ask me to hard-purge them if you want.)');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to deprovision:', err);
    process.exit(1);
  });
