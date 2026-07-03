import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, people } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { ImportClient } from './import-client';

// Data Import (Phase 4 — polling stations wired, voters & community leaders skeletoned).
//
// Role gate: only candidate / campaign_manager / chief_strategist / constituency_coordinator
// / tech_lead may see this page. Anyone else is bounced back to the dashboard.
//
// The page itself is a thin server-component shell that resolves the user's role and
// hands a privileged flag to the client.

const PRIVILEGED_ROLES = new Set([
  'candidate',
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'tech_lead',
]);

// Super Admins get in regardless of job role (e.g. Irene is Head of Media but a
// Super Admin with full access). Identity-stable by name.
const SUPER_ADMIN_NAMES = new Set([
  'Alfayo Nelson',
  'Benson Imoli',
  'Dan Ngure',
  'Irene Mkamburi',
]);

export default async function DataImportPage() {
  const claims = await getServerAuthOrRedirect();

  const personRows = await db
    .select({ role: people.role, fullName: people.fullName })
    .from(people)
    .where(eq(people.id, claims.sub))
    .limit(1);

  const person = personRows[0];
  const allowed = person && (PRIVILEGED_ROLES.has(person.role) || SUPER_ADMIN_NAMES.has(person.fullName));
  if (!allowed) {
    redirect('/dashboard?reason=insufficient_role');
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Data Import</h1>
        <p className="text-sm text-brand-textMuted">
          Upload polling-station spreadsheets, voter registers, or community-leader rosters.
          Excel and CSV are parsed for review before any database write. PDF and Word are
          accepted as supporting documents.
        </p>
      </header>

      <ImportClient userRole={person.role} userName={person.fullName} />
    </div>
  );
}
