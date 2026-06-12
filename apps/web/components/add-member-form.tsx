'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface WardOpt { id: string; name: string }

type Category = 'executive' | 'technical' | 'ward' | 'warembo';

// Role choices per category — labels shown to the user, values are campaign_role enum.
const EXEC_ROLES: { value: string; label: string }[] = [
  { value: 'campaign_manager', label: 'Campaign Manager' },
  { value: 'chief_strategist', label: 'Chief Strategist' },
  { value: 'constituency_coordinator', label: 'Constituency Coordinator' },
  { value: 'patron_ceo', label: 'Patron / CEO' },
  { value: 'finance_lead', label: 'Finance Lead' },
  { value: 'influence_liaison', label: 'Influence Liaison' },
];
const TECH_ROLES: { value: string; label: string }[] = [
  { value: 'tech_lead', label: 'Tech Lead' },
  { value: 'media_head', label: 'Media Team' },
  { value: 'comms_head', label: 'Comms Head' },
];
const WARD_ROLES: { value: string; label: string }[] = [
  { value: 'ward_coordinator', label: 'Ward Representative (in charge)' },
  { value: 'assistant_ward_coordinator', label: 'Assistant Ward Representative' },
  { value: 'canvasser', label: 'Member / Canvasser' },
];

const CATEGORIES: { value: Category; label: string; blurb: string }[] = [
  { value: 'executive', label: 'Executive', blurb: 'Constituency-wide leadership' },
  { value: 'technical', label: 'Technical', blurb: 'Tech / media / comms' },
  { value: 'ward', label: 'Ward', blurb: 'Grassroots, tied to a ward' },
  { value: 'warembo', label: 'Warembo', blurb: 'Warembo wa Alfayo wing' },
];

export function AddMemberForm({ wards }: { wards: WardOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>('ward');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('canvasser');
  const [wardId, setWardId] = useState('');
  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function pickCategory(c: Category) {
    setCategory(c);
    // Default the role to the first sensible choice for that category.
    if (c === 'executive') setRole('campaign_manager');
    else if (c === 'technical') setRole('tech_lead');
    else if (c === 'ward') setRole('canvasser');
    else setRole('influence_liaison'); // warembo (role fixed server-side)
  }

  function resetFields() {
    setFullName(''); setPhone(''); setEmail(''); setTitle(''); setWardId(''); setPhoto(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setDone(null);
    try {
      const fd = new FormData();
      fd.append('fullName', fullName);
      fd.append('phone', phone);
      fd.append('email', email);
      fd.append('category', category);
      fd.append('role', role);
      fd.append('wardId', wardId);
      fd.append('title', title);
      if (photo) fd.append('photo', photo);

      const res = await fetch('/api/team/create', { method: 'POST', body: fd });
      const body = await res.json();
      if (body.success) {
        setDone(`${body.data.fullName} added to ${CATEGORIES.find((c) => c.value === category)?.label}.`);
        resetFields();
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
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-burnt px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-rust transition"
      >
        + Add member
      </button>
    );
  }

  const field = 'w-full rounded-lg border border-brand-border bg-brand-field px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-burnt';
  const label = 'text-[11px] font-semibold uppercase tracking-wider text-brand-textMuted';
  const roleChoices = category === 'executive' ? EXEC_ROLES : category === 'technical' ? TECH_ROLES : WARD_ROLES;

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-brand-borderStrong bg-brand-cardBg p-4 space-y-4 max-w-xl">
      <div className="text-sm font-bold text-brand-textActive">Add a team member</div>

      {/* Category picker */}
      <div className="space-y-1.5">
        <div className={label}>Category</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => pickCategory(c.value)}
              className={[
                'rounded-lg border p-2 text-left transition',
                category === c.value
                  ? 'border-brand-burnt bg-brand-burnt/10'
                  : 'border-brand-border hover:border-brand-burnt/40',
              ].join(' ')}
            >
              <div className="text-xs font-bold text-brand-textActive">{c.label}</div>
              <div className="text-[10px] text-brand-textMuted leading-tight mt-0.5">{c.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="mbr-name" className={label}>Full name</label>
          <input id="mbr-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus placeholder="e.g. Jane Wanjiru" className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="mbr-phone" className={label}>Phone number</label>
          <input id="mbr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="07XX XXX XXX" className={field} />
        </div>

        {/* Role — Executive / Technical / Ward pick from a list; Warembo role is fixed. */}
        {category !== 'warembo' && (
          <div className="space-y-1">
            <label htmlFor="mbr-role" className={label}>{category === 'ward' ? 'Position' : 'Role'}</label>
            <select id="mbr-role" value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              {roleChoices.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        )}

        {/* Ward — required for ward members, optional for warembo. */}
        {(category === 'ward' || category === 'warembo') && (
          <div className="space-y-1">
            <label htmlFor="mbr-ward" className={label}>
              Ward {category === 'warembo' && <span className="normal-case text-brand-textMuted">(optional)</span>}
            </label>
            <select id="mbr-ward" value={wardId} onChange={(e) => setWardId(e.target.value)} required={category === 'ward'} className={field}>
              <option value="">{category === 'warembo' ? 'No specific ward' : 'Select ward…'}</option>
              {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="mbr-title" className={label}>
            Job title <span className="normal-case text-brand-textMuted">(optional)</span>
          </label>
          <input id="mbr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={category === 'warembo' ? 'e.g. Chairlady' : 'e.g. Director of Programs'} className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="mbr-email" className={label}>
            Email <span className="normal-case text-brand-textMuted">(optional)</span>
          </label>
          <input id="mbr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className={field} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="mbr-photo" className={label}>
            Photo <span className="normal-case text-brand-textMuted">(optional · JPG / PNG / WebP · max 5 MiB)</span>
          </label>
          <input
            id="mbr-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-brand-textActive file:mr-3 file:rounded-md file:border-0 file:bg-brand-burnt file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-white hover:file:bg-brand-rust"
          />
          {photo && <div className="text-[11px] text-brand-textMuted">Selected: <span className="font-mono">{photo.name}</span></div>}
        </div>
      </div>

      {error && <div className="text-xs text-brand-danger bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2">{error}</div>}
      {done && <div className="text-xs text-brand-success bg-brand-success/10 border border-brand-success/30 rounded-lg px-3 py-2">{done}</div>}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-burnt px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-rust transition disabled:opacity-50">
          {busy ? 'Saving…' : 'Save member'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setDone(null); setError(null); }} className="text-xs text-brand-textMuted hover:text-brand-textActive">Close</button>
      </div>
    </form>
  );
}
