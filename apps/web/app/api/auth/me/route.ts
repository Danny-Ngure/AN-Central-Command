import { people, wards } from '@an/db';
import { eq } from 'drizzle-orm';
import { ok, withAuth, withRlsTx } from '@/lib/api';

export const runtime = 'nodejs';

// GET /api/auth/me
//
// Returns the current user's identity + role + ward (if any) so the client can render
// the role-appropriate UI without re-decoding the JWT itself.
//
// Demonstrates the end-to-end stack:
//   JWT verify → session revocation check → DB transaction in app_user role →
//   RLS-scoped query for the person row.

export const GET = withAuth(async (_req, { claims }) => {
  const result = await withRlsTx(claims, async (tx) => {
    const personRows = await tx
      .select({
        id: people.id,
        fullName: people.fullName,
        phone: people.phone,
        email: people.email,
        role: people.role,
        wardId: people.wardId,
        lastActiveAt: people.lastActiveAt,
      })
      .from(people)
      .where(eq(people.id, claims.sub))
      .limit(1);

    if (personRows.length === 0) return null;
    const person = personRows[0];

    let wardName: string | null = null;
    if (person.wardId) {
      const wardRows = await tx
        .select({ name: wards.name })
        .from(wards)
        .where(eq(wards.id, person.wardId))
        .limit(1);
      wardName = wardRows[0]?.name ?? null;
    }

    return { ...person, wardName };
  });

  if (!result) {
    // The JWT subject doesn't match any row — possibly the person was deleted
    // after the session was issued. Treat as session invalid.
    return ok({ error: 'session_orphaned' }, { status: 401 });
  }
  return ok(result);
});
