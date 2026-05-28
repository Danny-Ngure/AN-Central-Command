import { eq } from 'drizzle-orm';
import { db, people, wards } from '@an/db';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';
import { getServerAuthOrRedirect } from '@/lib/server-auth';

// Route-group layout. Every page under apps/web/app/(authed)/ goes through this:
//   1. Verify session (redirect to /login on failure).
//   2. Fetch the person row + ward name for the navbar.
//   3. Render shell with navbar + sidebar around children.
//
// Note: this layout query runs as DB superuser (no setRequestContext). It only reads
// the user's own row + the ward they're already known to belong to — minimal exposure.
// Page-level queries use withRlsTx() to scope everything else.

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const claims = await getServerAuthOrRedirect();

  const personRows = await db
    .select({
      id: people.id,
      fullName: people.fullName,
      role: people.role,
      wardId: people.wardId,
    })
    .from(people)
    .where(eq(people.id, claims.sub))
    .limit(1);

  if (personRows.length === 0) {
    // Session points at a person that no longer exists; treat as orphaned.
    const { redirect } = await import('next/navigation');
    redirect('/login?reason=orphaned');
  }
  const person = personRows[0]!;

  let wardName: string | null = null;
  if (person.wardId) {
    const wardRows = await db
      .select({ name: wards.name })
      .from(wards)
      .where(eq(wards.id, person.wardId))
      .limit(1);
    wardName = wardRows[0]?.name ?? null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar user={{ fullName: person.fullName, role: person.role, wardName }} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
