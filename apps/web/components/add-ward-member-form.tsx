'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const ROLES = [
  { value: 'canvasser', label: 'Canvasser' },
  { value: 'polling_agent', label: 'Polling Agent' },
  { value: 'polling_station_lead', label: 'Polling Station Lead' },
  { value: 'influence_liaison', label: 'Mobiliser' },
];

// Inline "Add ward member" form — keys a campaign team member into a ward.
export function AddWardMemberForm({ wardId, wardName }: { wardId: string; wardName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('canvasser');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ward-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wardId, fullName, phone, role }),
      });
      const body = await res.json();
      if (body.success) {
        setFullName('');
        setPhone('');
        setRole('canvasser');
        setOpen(false);
        router.refresh();
      } else {
        setError(body.error?.message ?? 'Could not add member');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-burnt px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-brand-rust transition"
      >
        + Add member
      </button>
    );
  }

  const field = 'w-full rounded-lg border border-brand-border bg-brand-field px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-burnt';

  return (
    <form onSubmit={onSubmit} className="absolute right-0 z-20 mt-2 w-[min(92vw,26rem)] rounded-xl border border-brand-borderStrong bg-brand-cardBg p-4 space-y-3 shadow-2xl">
      <div className="text-sm font-bold text-brand-textActive">Add member to {wardName}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus placeholder="Full name" className={field} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+254 7XX XXX XXX" className={field} />
        <select value={role} onChange={(e) => setRole(e.target.value)} className={`${field} sm:col-span-2`}>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      {error && <div className="text-xs text-brand-danger bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-burnt px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-rust transition disabled:opacity-50">
          {busy ? 'Saving…' : 'Save member'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-brand-textMuted hover:text-brand-textActive">Cancel</button>
      </div>
    </form>
  );
}
