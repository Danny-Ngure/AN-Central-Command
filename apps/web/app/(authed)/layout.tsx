import { eq } from 'drizzle-orm';
import { db, people, wards } from '@an/db';
import { AutoBreadcrumbs } from '@/components/auto-breadcrumbs';
import { Countdown } from '@/components/countdown';
import { QuickAdd } from '@/components/quick-add';
import { SiteFooter } from '@/components/site-footer';
import { TopNav } from '@/components/top-nav';
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

  // All wards — feeds the "Wards" mega-menu in the top nav (id + name only).
  const allWards = await db
    .select({ id: wards.id, name: wards.name })
    .from(wards)
    .orderBy(wards.name);

  return (
    <div className="min-h-screen flex flex-col bg-brand-darkBg">
      <TopNav user={{ fullName: person.fullName, role: person.role, wardName }} wards={allWards} />
      {/* SRS FR-090 — hero countdown strip, full-width below the main navbar. */}
      <Countdown />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto p-4 lg:p-6">
          <AutoBreadcrumbs />
          {children}
        </div>
        {/* Full-width per-page footer — the hero photo changes per route.
            See apps/web/components/site-footer.tsx for the route → image map. */}
        <SiteFooter />
      </main>
      {/* Global quick-entry — log an activity from anywhere; flows into the system. */}
      <QuickAdd wards={allWards} />
    </div>
  );
}
