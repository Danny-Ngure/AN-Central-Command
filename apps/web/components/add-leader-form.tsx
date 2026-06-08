'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface WardOpt { id: string; name: string }
interface VillageOpt { id: string; name: string; wardId: string }

// Common community-leader roles (chiefs, elders, etc.). Stored as free-text roleTitle.
const ROLES = [
  'Chief',
  'Assistant Chief',
  'Village Elder',
  'Nyumba Kumi Elder',
  'Religious Leader',
  'Youth Leader',
  'Women Leader',
  'Boda Boda Chairman',
  'Business / Market Leader',
  'Other',
];

// "Add community leader" form. Ward drives the village dropdown.
export function AddLeaderForm({ wards, villages }: { wards: WardOpt[]; villages: VillageOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Chief');
  const [wardId, setWardId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const wardVillages = useMemo(() => villages.filter((v) => v.wardId === wardId), [villages, wardId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch('/api/community/leaders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, roleTitle: role, wardId, villageId }),
      });
      const body = await res.json();
      if (body.success) {
        setOk(`${fullName} added${body.data?.queued ? ' (pending review)' : ''}.`);
        setFullName('');
        setPhone('');
        setRole('Chief');
        router.refresh();
      } else {
        setError(body.error?.message ?? 'Could not add leader');
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
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-burnt px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-rust transition"
      >
        + Add community leader
      </button>
    );
  }

  const field = 'w-full rounded-lg border border-brand-border bg-brand-field px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-burnt';
  const label = 'text-[11px] font-semibold uppercase tracking-wider text-brand-textMuted';

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-brand-borderStrong bg-brand-cardBg p-4 space-y-3 max-w-lg">
      <div className="text-sm font-bold text-brand-textActive">Add a community leader</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="ldr-name" className={label}>Full name</label>
          <input id="ldr-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus placeholder="e.g. Mzee Juma Ali" className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="ldr-phone" className={label}>Phone number</label>
          <input id="ldr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+254 7XX XXX XXX" className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="ldr-role" className={label}>Role</label>
          <select id="ldr-role" value={role} onChange={(e) => setRole(e.target.value)} className={field}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="ldr-ward" className={label}>Ward</label>
          <select
            id="ldr-ward"
            value={wardId}
            onChange={(e) => { setWardId(e.target.value); setVillageId(''); }}
            required
            className={field}
          >
            <option value="">Select ward…</option>
            {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="ldr-village" className={label}>Village</label>
          <select id="ldr-village" value={villageId} onChange={(e) => setVillageId(e.target.value)} required disabled={!wardId} className={field}>
            <option value="">{wardId ? (wardVillages.length ? 'Select village…' : 'No villages in this ward yet') : 'Select a ward first'}</option>
            {wardVillages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="text-xs text-brand-danger bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="text-xs text-brand-success bg-brand-success/10 border border-brand-success/30 rounded-lg px-3 py-2">{ok}</div>}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-burnt px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-rust transition disabled:opacity-50">
          {busy ? 'Saving…' : 'Save leader'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-brand-textMuted hover:text-brand-textActive">Cancel</button>
      </div>
    </form>
  );
}
