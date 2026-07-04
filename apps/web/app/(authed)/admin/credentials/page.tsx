import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { isSuperAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SUPER-ADMIN-ONLY credentials vault view (campaign direction: Dan must be able to see
// every member's current login password). Passwords are hashed (one-way), so we read a
// SEPARATE encrypted-at-rest recovery copy (auth_credentials.password_recovery_enc,
// kept in sync on every set/reset/change) and decrypt it here with the pgcrypto key.
// The page 404s for anyone who is not the super admin.

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Candidate / Aspirant', chief_strategist: 'Chief Strategist',
  campaign_manager: 'Campaign Manager', constituency_coordinator: 'Constituency Coordinator',
  tech_lead: 'Tech Lead / Super Admin', media_head: 'Media', comms_head: 'Comms Head',
  finance_lead: 'Finance Lead', ward_coordinator: 'Ward Representative',
  assistant_ward_coordinator: 'Assistant Ward Rep', influence_liaison: 'Influence Liaison',
  canvasser: 'Canvasser', polling_agent: 'Polling Agent', polling_station_lead: 'Polling Lead',
  patron_ceo: 'Patron / CEO',
};

const TIER_ORDER = [
  'candidate', 'chief_strategist', 'campaign_manager', 'constituency_coordinator', 'tech_lead',
  'media_head', 'comms_head', 'finance_lead',
  'ward_coordinator', 'assistant_ward_coordinator',
  'influence_liaison', 'canvasser', 'polling_station_lead', 'polling_agent', 'patron_ceo',
];

type Row = { id: string; full_name: string; phone: string; role: string; password: string | null };

export default async function CredentialsVault() {
  const claims = await getServerAuthOrRedirect();
  if (!(await isSuperAdmin(claims.sub))) notFound();

  const key = process.env.PGCRYPTO_KEY ?? '';
  const rows = (await db.execute(sql`
    SELECT p.id, p.full_name, p.phone, p.role::text AS role,
           CASE WHEN ac.password_recovery_enc IS NOT NULL AND ${key} <> ''
                THEN pgp_sym_decrypt(ac.password_recovery_enc, ${key})
                ELSE NULL END AS password
    FROM people p
    JOIN auth_credentials ac ON ac.person_id = p.id
    WHERE p.active = true AND p.deleted_at IS NULL
    ORDER BY array_position(${sql.raw(`ARRAY[${TIER_ORDER.map((r) => `'${r}'`).join(',')}]::text[]`)}, p.role::text), p.full_name
  `)) as unknown as Row[];

  const real = rows.filter((r) => !r.full_name.startsWith('View-As'));
  const personas = rows.filter((r) => r.full_name.startsWith('View-As'));
  const missing = real.filter((r) => !r.password).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          <h1 className="text-2xl font-bold text-brand-textActive">Credentials Vault</h1>
          <span className="rounded-full bg-brand-rust/15 border border-brand-rust/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-rust">
            Super Admin only
          </span>
        </div>
        <p className="text-sm text-brand-textMuted">
          Every active member&rsquo;s current login and password. Only you (Dan) can see this page.
          Passwords are stored encrypted and kept in sync whenever anyone&rsquo;s password is set,
          reset, or changed. Tap a name to open their profile and reset it.
        </p>
        <p className="text-xs text-brand-textMuted">
          {real.length} members{personas.length ? ` · ${personas.length} demo personas` : ''}
          {missing ? ` · ${missing} without a stored copy (reset to capture)` : ''}
        </p>
      </header>

      {/* Database backup — super-admin download (contains PII; never share publicly) */}
      <div className="rounded-xl border border-brand-teal/40 bg-brand-teal/[0.06] p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">💾</span>
          <h2 className="text-sm font-bold text-brand-textActive">Database backup</h2>
        </div>
        <p className="mt-1 text-xs text-brand-textMuted">
          Download a fresh dump of the whole database (schema + all data). Contains voter PII and password
          hashes — keep it private, don&rsquo;t upload it anywhere public.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/api/admin/backup"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-burnt"
          >
            ⬇️ Download backup (.dump · compressed)
          </a>
          <a
            href="/api/admin/backup?format=sql"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-brand-borderStrong px-4 py-2 text-sm font-semibold text-brand-textActive transition hover:border-brand-burnt hover:text-brand-burnt"
          >
            ⬇️ Download as .sql (plain, larger)
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-cardBgHeavy/60 text-left text-[11px] font-bold uppercase tracking-wider text-brand-textMuted">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Login (phone)</th>
              <th className="px-3 py-2">Password</th>
              <th className="px-3 py-2">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/60">
            {real.map((r) => (
              <tr key={r.id} className="hover:bg-brand-burnt/[0.04]">
                <td className="px-3 py-2">
                  <Link href={`/team/${r.id}`} className="font-semibold text-brand-textActive hover:text-brand-burnt hover:underline">
                    {r.full_name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-brand-textActive">{r.phone}</td>
                <td className="px-3 py-2">
                  {r.password ? (
                    <code className="select-all rounded bg-black/20 px-2 py-0.5 font-bold text-brand-textActive">{r.password}</code>
                  ) : (
                    <span className="text-brand-textMuted italic">— reset to capture —</span>
                  )}
                </td>
                <td className="px-3 py-2 text-brand-textMuted">{ROLE_LABEL[r.role] ?? r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {personas.length > 0 && (
        <p className="text-xs text-brand-textMuted">
          <span className="font-bold">Demo personas:</span>{' '}
          {personas.map((r) => `${r.full_name} (${r.phone} / ${r.password ?? '—'})`).join(', ')}
        </p>
      )}

      <p className="rounded-lg border border-brand-rust/30 bg-brand-rust/[0.06] px-3 py-2 text-xs text-brand-textMuted">
        ⚠ Confidential. This vault keeps recoverable copies of passwords so you can help members who
        forget theirs — encrypted at rest and visible to no one else. Rotate the encryption key before any
        real deployment, and prefer resetting a member&rsquo;s password over sharing it.
      </p>
    </div>
  );
}
