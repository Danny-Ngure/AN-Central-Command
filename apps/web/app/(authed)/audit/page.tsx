import Link from 'next/link';
import { auditLog, db, people, sessions, wards } from '@an/db';
import { desc, eq } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

// Access & Audit Log viewer.
//
// VISIBILITY RULE (per campaign direction):
//   • Dan Ngure is the sole "system auditor" super admin. Only he sees WHO has
//     accessed the system — every sign-in across all users, with the device /
//     phone type and IP — plus the full write audit trail.
//   • Everyone else, INCLUDING the other three super admins (Alfayo Nelson,
//     Benson Imoli, Irene Mkamburi), sees ONLY their own sign-ins. They cannot
//     see anyone else's access, not even a fellow admin's.
//
// Enforcement is layered: the sessions RLS policy (extras/03) is self-only, so a
// normal withRlsTx query already returns only the caller's rows. The all-users
// view for Dan deliberately reads through the superuser connection AFTER an
// app-level identity check that the caller is Dan Ngure.

// The single identity that unlocks the system-wide access log. Stable by name so
// phone / ID changes never grant or revoke it accidentally.
const SYSTEM_AUDITOR_NAME = 'Dan Ngure';

const ACTION_STYLE: Record<string, string> = {
  INSERT: 'text-emerald-400',
  UPDATE: 'text-brand-skyblue',
  DELETE: 'text-brand-danger',
};

function actionTone(action: string): string {
  for (const prefix of Object.keys(ACTION_STYLE)) {
    if (action.startsWith(prefix)) return ACTION_STYLE[prefix];
  }
  return 'text-brand-textActive';
}

// Turn a raw audit row into a plain-English "who did what" for the activity feed.
const ENTITY_WORD: Record<string, string> = {
  community_sites: 'a site', community_leaders: 'a community leader', village_issues: 'an issue',
  villages: 'a village', polling_stations: 'a polling station', people: 'a team member',
  auth_credentials: 'a password', meetings: 'a meeting', activities: 'an activity',
  visits: 'a visit', station_reports: 'a station report', incidents: 'an incident',
  wards: 'a ward', committed_supporters: 'a supporter',
};
function describeActivity(action: string, entityType: string | null, after: any): string {
  const a = (after && typeof after === 'object') ? after : {};
  const name = a.name || a.target || a.fullName || '';
  switch (action) {
    case 'CREATE_SITE': return `Added a ${a.type ?? 'site'}${name ? `: ${name}` : ''}`;
    case 'CREATE_POLLING_STATION': return `Added a polling station${name ? `: ${name}` : ''}`;
    case 'CREATE_TEAM_MEMBER': return `Added a team member${name ? `: ${name}` : ''}${a.role ? ` (${a.role})` : ''}`;
    case 'CHANGE_PASSWORD': return 'Changed their password';
    case 'ADMIN_RESET_PASSWORD': return `Reset ${a.target ? `${a.target}'s` : 'a'} password`;
    case 'CHANGE_ROLE': return `Changed ${a.target ?? 'a member'}'s role${a.role ? ` → ${a.role}` : ''}`;
  }
  const m = action.match(/^(INSERT|UPDATE|DELETE)_(.+)$/);
  if (m) {
    const verb = m[1] === 'INSERT' ? 'Added' : m[1] === 'UPDATE' ? 'Updated' : 'Deleted';
    const word = ENTITY_WORD[m[2]] ?? m[2].replace(/_/g, ' ');
    return `${verb} ${word}${name ? `: ${name}` : ''}`;
  }
  return action.replace(/_/g, ' ').toLowerCase();
}

// Turn a raw User-Agent string into a human "phone / device type" label.
function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const s = ua.toLowerCase();
  if (s.includes('android')) return s.includes('mobile') ? 'Android phone' : 'Android tablet';
  if (s.includes('iphone')) return 'iPhone';
  if (s.includes('ipad')) return 'iPad';
  if (s.includes('windows')) return 'Windows PC';
  if (s.includes('macintosh') || s.includes('mac os')) return 'Mac';
  if (s.includes('cros')) return 'Chromebook';
  if (s.includes('linux')) return 'Linux PC';
  return 'Other device';
}

function browserLabel(ua: string | null): string {
  if (!ua) return '';
  const s = ua.toLowerCase();
  if (s.includes('edg/')) return 'Edge';
  if (s.includes('chrome/') && !s.includes('edg/')) return 'Chrome';
  if (s.includes('firefox/')) return 'Firefox';
  if (s.includes('safari/') && !s.includes('chrome/')) return 'Safari';
  return '';
}

function fmt(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().replace('T', ' ').replace(/\..*/, '');
}

const PAGE_SIZE = 150;

export default async function AuditLogPage() {
  const claims = await getServerAuthOrRedirect();

  // Who is asking? Self-read is permitted by the people RLS policy.
  const me = await withRlsTx(claims, async (tx) =>
    tx.select({ fullName: people.fullName }).from(people).where(eq(people.id, claims.sub)).limit(1),
  );
  const myName = me[0]?.fullName ?? '';
  const isAuditor = myName === SYSTEM_AUDITOR_NAME;

  type AccessRow = {
    id: string;
    name: string;
    role: string;
    ward: string | null;
    userAgent: string | null;
    ip: string | null;
    loginAt: Date;
    lastUsed: Date | null;
    revokedAt: Date | null;
  };

  let access: AccessRow[] = [];
  if (isAuditor) {
    // SYSTEM-WIDE view — every user's sign-ins. Deliberately reads via the
    // superuser connection (bypasses the self-only sessions RLS) BECAUSE we have
    // just verified the caller is the designated system auditor above.
    access = await db
      .select({
        id: sessions.id,
        name: people.fullName,
        role: people.role,
        ward: wards.name,
        userAgent: sessions.userAgent,
        ip: sessions.ipAddress,
        loginAt: sessions.createdAt,
        lastUsed: sessions.lastUsedAt,
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .innerJoin(people, eq(sessions.personId, people.id))
      .leftJoin(wards, eq(people.wardId, wards.id))
      .orderBy(desc(sessions.createdAt))
      .limit(PAGE_SIZE);
  } else {
    // EVERYONE ELSE — own sign-ins only. The sessions RLS policy (self-only)
    // guarantees no other user's rows can come back even if the filter were absent.
    access = await withRlsTx(claims, async (tx) =>
      tx
        .select({
          id: sessions.id,
          userAgent: sessions.userAgent,
          ip: sessions.ipAddress,
          loginAt: sessions.createdAt,
          lastUsed: sessions.lastUsedAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .where(eq(sessions.personId, claims.sub))
        .orderBy(desc(sessions.createdAt))
        .limit(PAGE_SIZE)
        .then((rows) =>
          rows.map((r) => ({ ...r, name: myName, role: claims.role, ward: null as string | null })),
        ),
    );
  }

  // Write audit trail — auditor only. (RLS also restricts this to leadership, but
  // we scope the section to the auditor to match the "only Dan" rule.)
  const writeRowsRaw = isAuditor
    ? await db
        .select({
          id: auditLog.id,
          timestamp: auditLog.timestamp,
          actorRole: auditLog.actorRole,
          actorName: people.fullName,
          action: auditLog.action,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          afterValue: auditLog.afterValue,
          ipAddress: auditLog.ipAddress,
        })
        .from(auditLog)
        .leftJoin(people, eq(people.id, auditLog.actorPersonId))
        .orderBy(desc(auditLog.timestamp))
        .limit(PAGE_SIZE * 3)
    : [];
  // Sign-ins already appear in the Access log above — keep this feed to actual changes.
  const writeRows = writeRowsRaw.filter((r) => r.entityType !== 'sessions').slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-brand-textActive">
            {isAuditor ? 'Access & Audit Logs' : 'My Sign-ins'}
          </h1>
          <span className="text-[10px] uppercase tracking-wider text-brand-textMuted border border-brand-border rounded px-2 py-0.5">
            append-only
          </span>
          {isAuditor && (
            <span className="text-[10px] uppercase tracking-wider text-white bg-brand-burnt rounded px-2 py-0.5">
              System auditor
            </span>
          )}
          {isAuditor && (
            <Link
              href="/admin/credentials"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-rust px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-burnt"
            >
              🔐 Credentials Vault
            </Link>
          )}
        </div>
        <p className="text-sm text-brand-textMuted">
          {isAuditor ? (
            <>
              You are the system auditor. This page shows <strong>who has accessed the system</strong> —
              every sign-in, the device / phone type used, and the IP address.
            </>
          ) : (
            <>
              For your privacy and everyone else&apos;s, you can see <strong>only your own sign-ins</strong>.
              System-wide access records are visible to the system auditor only.
            </>
          )}
        </p>
      </header>

      {/* ---- Access log: who signed in, from what device ---- */}
      <section className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-border bg-black/10">
          <h2 className="text-sm font-bold text-brand-textActive">
            {isAuditor ? 'System access — all users' : 'Your sign-ins'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/10 border-b border-brand-border">
              <tr className="text-left text-xs uppercase tracking-wider text-brand-textMuted">
                {isAuditor && <th className="px-4 py-3 font-semibold">User</th>}
                {isAuditor && <th className="px-4 py-3 font-semibold">Role / Ward</th>}
                <th className="px-4 py-3 font-semibold">Device / phone type</th>
                <th className="px-4 py-3 font-semibold">IP</th>
                <th className="px-4 py-3 font-semibold">Signed in</th>
                <th className="px-4 py-3 font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody>
              {access.length === 0 ? (
                <tr>
                  <td colSpan={isAuditor ? 6 : 4} className="px-4 py-8 text-center text-brand-textMuted">
                    No sign-ins recorded yet.
                  </td>
                </tr>
              ) : (
                access.map((r) => {
                  const browser = browserLabel(r.userAgent);
                  return (
                    <tr key={r.id} className="border-b border-brand-border/40 hover:bg-black/20 transition">
                      {isAuditor && (
                        <td className="px-4 py-3 text-brand-textActive font-semibold">
                          {r.name}
                          {r.revokedAt && (
                            <span className="ml-2 text-[10px] uppercase text-brand-danger">revoked</span>
                          )}
                        </td>
                      )}
                      {isAuditor && (
                        <td className="px-4 py-3 text-xs text-brand-textMuted">
                          <span className="uppercase tracking-wider">{r.role}</span>
                          {r.ward && <span className="block text-brand-textMuted/70">{r.ward}</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-brand-textActive">
                        {deviceLabel(r.userAgent)}
                        {browser && <span className="text-brand-textMuted/70"> · {browser}</span>}
                      </td>
                      <td className="px-4 py-3 text-brand-textMuted font-mono text-xs">{r.ip ?? '—'}</td>
                      <td className="px-4 py-3 text-brand-textMuted font-mono text-xs">{fmt(r.loginAt)}</td>
                      <td className="px-4 py-3 text-brand-textMuted font-mono text-xs">{fmt(r.lastUsed)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Write audit trail: auditor only ---- */}
      {isAuditor && (
        <section className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border bg-black/10">
            <h2 className="text-sm font-bold text-brand-textActive">Change history — every write</h2>
            <p className="text-xs text-brand-textMuted mt-0.5">
              Recorded by a Postgres trigger. UPDATE / DELETE are blocked at the DB layer for every
              role except <code>admin_audit</code> (SRS NFR-050). Retention: 7 years.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/10 border-b border-brand-border">
                <tr className="text-left text-xs uppercase tracking-wider text-brand-textMuted">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Who</th>
                  <th className="px-4 py-3 font-semibold">Did what</th>
                </tr>
              </thead>
              <tbody>
                {writeRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-brand-textMuted">
                      No activity yet.
                    </td>
                  </tr>
                ) : (
                  writeRows.map((r) => (
                    <tr key={r.id} className="border-b border-brand-border/40 hover:bg-black/20 transition">
                      <td className="px-4 py-3 text-brand-textMuted font-mono text-xs whitespace-nowrap">{fmt(r.timestamp)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-semibold text-brand-textActive">{r.actorName ?? 'System'}</span>
                        {r.actorRole && r.actorRole !== 'self' && (
                          <span className="block text-[10px] uppercase tracking-wider text-brand-textMuted">{r.actorRole}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${actionTone(r.action)}`}>
                        {describeActivity(r.action, r.entityType, r.afterValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
