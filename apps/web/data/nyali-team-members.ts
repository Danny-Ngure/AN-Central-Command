// Extra ward team members added by request but not yet seeded into the DB.
// Rendered (read-only) in the ward page's "Ward Members" list so they reflect
// immediately. Persist later via a team seed (tools/seed-team.cjs pattern).
//
// Ward IDs: Kadzandani …001 · Kongowea …002 · Mkomani …003 · Frere Town …004 · Ziwa …005

export interface ExtraMember {
  wardId: string;
  fullName: string;
  role: string;
  title: string | null; // free-text label (village / role) shown under the name
  phone: string | null;
}

export const NYALI_EXTRA_MEMBERS: ExtraMember[] = [
  {
    wardId: '22222222-0000-4000-8000-000000000002', // Kongowea
    fullName: 'Damaris Atuga',
    role: 'canvasser',
    title: 'Member · Kambi Kikuyu',
    phone: '+254724935918',
  },
];

// PersonRow-shaped rows for the /team org chart (Grassroots & Ward Coordination).
// Injected into the team page's people list so they appear under their ward.
export function extraTeamPeople(): any[] {
  return NYALI_EXTRA_MEMBERS.map((m, i) => ({
    id: `nyali-extra-${i}`,
    fullName: m.fullName,
    role: m.role,
    title: m.title,
    wardId: m.wardId,
    phone: m.phone,
    email: null,
    photoUrl: null,
    lastActiveAt: null,
    teamId: null,
    nationalId: null,
  }));
}

// Member-shaped rows for the ward page's Ward Members grid.
export function extraMembersForWard(wardId: string): Array<{
  id: string;
  fullName: string;
  role: string;
  title: string | null;
  phone: string | null;
}> {
  return NYALI_EXTRA_MEMBERS.filter((m) => m.wardId === wardId).map((m, i) => ({
    id: `nyali-member-${wardId.slice(-2)}-${i}`,
    fullName: m.fullName,
    role: m.role,
    title: m.title,
    phone: m.phone,
  }));
}
