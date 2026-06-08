import { auditLog } from '@an/db';
import { desc } from 'drizzle-orm';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';

// Audit Log viewer. The RLS policy in extras/03 restricts read access to leadership
// and oversight (patron_ceo). Other roles get an empty result set — UI shows the
// empty state without confirming whether the table is empty or just inaccessible
// (similar 404-not-403 spirit as supporters).
//
// The table is also append-only (extras/01 trigger denies UPDATE/DELETE for everyone
// except the sealed admin_audit role). Nothing in this page is a write.

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

const PAGE_SIZE = 100;

export default async function AuditLogPage() {
  const claims = await getServerAuthOrRedirect();

  const rows = await withRlsTx(claims, async (tx) =>
    tx
      .select({
        id: auditLog.id,
        timestamp: auditLog.timestamp,
        actorRole: auditLog.actorRole,
        actorPersonId: auditLog.actorPersonId,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        ipAddress: auditLog.ipAddress,
      })
      .from(auditLog)
      .orderBy(desc(auditLog.timestamp))
      .limit(PAGE_SIZE),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-brand-textActive">Audit Logs</h1>
          <span className="text-[10px] uppercase tracking-wider text-brand-textMuted border border-brand-border rounded px-2 py-0.5">
            append-only
          </span>
        </div>
        <p className="text-sm text-brand-textMuted">
          Every write to the platform is recorded by a Postgres trigger. UPDATE and DELETE
          are blocked at the DB layer for every role except <code>admin_audit</code>
          (sealed-key, SRS NFR-050). Retention: 7 years.
        </p>
      </header>

      <section className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/10 border-b border-brand-border">
            <tr className="text-left text-xs uppercase tracking-wider text-brand-textMuted">
              <th className="px-4 py-3 font-semibold">Timestamp</th>
              <th className="px-4 py-3 font-semibold">Actor role</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Entity</th>
              <th className="px-4 py-3 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-textMuted">
                  No audit log entries visible at your access level.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-brand-border/40 hover:bg-black/20 transition">
                  <td className="px-4 py-3 text-brand-textMuted font-mono text-xs">
                    {new Date(r.timestamp).toISOString().replace('T', ' ').replace(/\..*/, '')}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider text-brand-textMuted">
                    {r.actorRole}
                  </td>
                  <td className={`px-4 py-3 font-semibold text-xs uppercase tracking-wider ${actionTone(r.action)}`}>
                    {r.action}
                  </td>
                  <td className="px-4 py-3 text-brand-textMuted font-mono text-xs">
                    {r.entityType}
                    {r.entityId && (
                      <span className="text-brand-textMuted/60">
                        {' '}· {r.entityId.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brand-textMuted font-mono text-xs">
                    {r.ipAddress ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {rows.length === PAGE_SIZE && (
          <div className="px-4 py-2 text-xs text-brand-textMuted border-t border-brand-border bg-black/20">
            Showing first {PAGE_SIZE} entries. Cursor-based pagination + filters (action,
            actor, entity) land in a follow-up commit.
          </div>
        )}
      </section>
    </div>
  );
}
