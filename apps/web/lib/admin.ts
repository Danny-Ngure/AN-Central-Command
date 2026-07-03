import { eq } from 'drizzle-orm';
import { db, people } from '@an/db';

// Central definition of the campaign's admin tiers (see packages/db/extras/07_permission_tiers.sql
// for the matching DB-level RLS enforcement).
//
//   • SUPER ADMIN  — Dan Ngure. Sole holder of: full audit log, admin password reset,
//                    and the power to assign admin/leadership roles.
//   • EXECUTIVE    — Alfayo Nelson (candidate) + Benson Imoli & Irene Mkamburi
//                    (chief_strategist), plus Dan (tech_lead). May add rank-and-file
//                    team members and edit content everywhere.
//
// Identity-stable by full name so phone / ID changes never grant or revoke it.
export const SUPER_ADMIN_NAME = 'Dan Ngure';

// Roles allowed to add a (rank-and-file) team member — the executive write tier.
export const MEMBER_CREATOR_ROLES = new Set(['candidate', 'chief_strategist', 'tech_lead']);

// Admin / leadership roles. Assigning any of these to a person is a "power grant"
// and is reserved for the Super Admin (Dan) alone.
export const ELEVATED_ROLES = new Set([
  'candidate', 'campaign_manager', 'chief_strategist', 'constituency_coordinator', 'tech_lead',
]);

/** True iff the given person is the Super Admin (Dan Ngure). Looks up the name so a
 *  rotated phone/ID can never accidentally grant or revoke super-admin powers. */
export async function isSuperAdmin(personId: string): Promise<boolean> {
  const rows = await db
    .select({ fullName: people.fullName })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  return rows[0]?.fullName === SUPER_ADMIN_NAME;
}
