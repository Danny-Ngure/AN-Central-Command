'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// SUPER-ADMIN-ONLY (Dan) control to change a member's role. Ward-scoped roles reveal a
// ward picker. The change takes effect on the member's next sign-in.

const ROLES: { value: string; label: string; wardScoped?: boolean }[] = [
  { value: 'candidate', label: 'Candidate / Aspirant' },
  { value: 'chief_strategist', label: 'Chief Strategist' },
  { value: 'campaign_manager', label: 'Campaign Manager' },
  { value: 'constituency_coordinator', label: 'Constituency Coordinator' },
  { value: 'tech_lead', label: 'Tech Lead / Super Admin' },
  { value: 'media_head', label: 'Media Head' },
  { value: 'comms_head', label: 'Comms Head' },
  { value: 'finance_lead', label: 'Finance Lead' },
  { value: 'patron_ceo', label: 'Patron / CEO' },
  { value: 'ward_coordinator', label: 'Ward Representative', wardScoped: true },
  { value: 'assistant_ward_coordinator', label: 'Assistant Ward Rep', wardScoped: true },
  { value: 'polling_station_lead', label: 'Polling Station Lead', wardScoped: true },
  { value: 'polling_agent', label: 'Polling Agent', wardScoped: true },
  { value: 'influence_liaison', label: 'Influence Liaison' },
  { value: 'canvasser', label: 'Canvasser' },
];
const WARD_SCOPED = new Set(ROLES.filter((r) => r.wardScoped).map((r) => r.value));
const inputClass =
  'w-full min-h-[44px] rounded-lg border border-brand-border bg-brand-field px-3 py-2 text-sm text-brand-textActive focus:border-brand-burnt focus:outline-none';

export function AdminChangeRole({
  personId,
  name,
  currentRole,
  currentWardId,
  wards,
}: {
  personId: string;
  name: string;
  currentRole: string;
  currentWardId: string | null;
  wards: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [wardId, setWardId] = useState(currentWardId ?? '');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const needsWard = WARD_SCOPED.has(role);
  const dirty = role !== currentRole || (needsWard && wardId !== (currentWardId ?? ''));
  const newRoleLabel = ROLES.find((r) => r.value === role)?.label ?? role;

  async function save() {
    setConfirming(false);
    setSaving(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/team/${personId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, wardId: needsWard ? wardId : null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setFlash('!' + (json?.error?.message ?? 'Could not change the role.'));
      } else {
        setFlash(`Role changed to ${ROLES.find((r) => r.value === role)?.label ?? role}. Takes effect on their next sign-in.`);
        router.refresh();
      }
    } catch {
      setFlash('!Network problem — please try again.');
    }
    setSaving(false);
  }

  return (
    <div className="rounded-xl border border-brand-teal/40 bg-brand-teal/[0.06] p-4">
      <div className="flex items-center gap-2">
        <span className="text-base">🛡️</span>
        <h3 className="text-sm font-bold text-brand-textActive">Super Admin — change {name.split(' ')[0]}&rsquo;s role</h3>
      </div>
      <p className="mt-1 text-xs text-brand-textMuted">
        Only you (Dan) can change roles. The new role decides what {name.split(' ')[0]} can see and edit; it applies on their next login. Recorded in the audit log.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-textMuted">Role</span>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        {needsWard && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-textMuted">Ward</span>
            <select className={inputClass} value={wardId} onChange={(e) => setWardId(e.target.value)}>
              <option value="">Choose a ward…</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {flash && (
        <p className={`mt-2 text-sm font-semibold ${flash.startsWith('!') ? 'text-brand-danger' : 'text-brand-success'}`}>
          {flash.startsWith('!') ? flash.slice(1) : flash}
        </p>
      )}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!dirty || saving || (needsWard && !wardId)}
          className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-burnt disabled:cursor-not-allowed disabled:opacity-40"
        >
          Change role
        </button>
      ) : (
        <div className="mt-3 rounded-lg border border-brand-teal/40 bg-black/10 p-3">
          <p className="text-sm font-semibold text-brand-textActive">
            Change {name}&rsquo;s role to <span className="text-brand-teal">{newRoleLabel}</span>?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={saving} className="min-h-[40px] rounded-lg bg-brand-teal px-4 py-2 text-sm font-bold text-white hover:bg-brand-burnt disabled:opacity-50">
              {saving ? 'Saving…' : 'Yes, change it'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="min-h-[40px] rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold text-brand-textMuted hover:text-brand-textActive">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
