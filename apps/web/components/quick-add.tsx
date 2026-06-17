'use client';

// Global Quick Add — a floating button on every page that logs an activity in
// seconds. It posts to /api/activities/create (no site required) and refreshes
// the current page so the entry flows straight into the dashboard, meetings and
// ward views. Plan something ahead, or log something that just happened.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Ward = { id: string; name: string };

const TYPES: { v: string; l: string }[] = [
  { v: 'rally', l: '📣 Rally' },
  { v: 'baraza', l: '🗣️ Baraza' },
  { v: 'community_meeting', l: '👥 Community meeting' },
  { v: 'door_to_door', l: '🚪 Door-to-door' },
  { v: 'mosque_visit', l: '🕌 Mosque visit' },
  { v: 'church_visit', l: '⛪ Church visit' },
  { v: 'market_visit', l: '🛒 Market visit' },
  { v: 'boda_stage_stop', l: '🏍️ Boda stage stop' },
  { v: 'chama_meeting', l: '💰 Chama meeting' },
  { v: 'youth_event', l: '🧑‍🤝‍🧑 Youth event' },
  { v: 'women_event', l: '👩 Women event' },
  { v: 'harambee', l: '🤝 Harambee' },
  { v: 'condolence_visit', l: '🕊️ Condolence visit' },
  { v: 'wedding_attendance', l: '💍 Wedding' },
  { v: 'courtesy_call', l: '☎️ Courtesy call' },
  { v: 'media_engagement', l: '🎙️ Media engagement' },
  { v: 'launch_event', l: '🚀 Launch event' },
  { v: 'town_hall', l: '🏛️ Town hall' },
  { v: 'internal_strategy', l: '♟️ Internal strategy' },
  { v: 'training', l: '🎓 Training' },
  { v: 'other', l: '• Other' },
];

function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function QuickAdd({ wards }: { wards: Ward[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [type, setType] = useState('community_meeting');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [wardId, setWardId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [status, setStatus] = useState<'planned' | 'completed'>('planned');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [candidateAttended, setCandidateAttended] = useState(false);
  const [notes, setNotes] = useState('');

  // Default the time to now on open (client-only → no hydration mismatch).
  useEffect(() => {
    if (open && !when) setWhen(nowLocalInput());
  }, [open, when]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function reset() {
    setType('community_meeting');
    setTitle('');
    setWhen(nowLocalInput());
    setWardId('');
    setLocationName('');
    setStatus('planned');
    setExpected('');
    setActual('');
    setCandidateAttended(false);
    setNotes('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Add a short title');
    if (!when) return setError('Pick a date & time');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('title', title.trim());
      fd.set('type', type);
      fd.set('scheduledAt', when);
      fd.set('status', status);
      if (wardId) fd.set('wardId', wardId);
      if (locationName.trim()) fd.set('locationName', locationName.trim());
      if (status === 'completed') {
        if (actual) fd.set('actualAttendance', actual);
        if (candidateAttended) fd.set('candidateAttended', 'true');
      } else if (expected) {
        fd.set('expectedAttendance', expected);
      }
      if (notes.trim()) fd.set('outcomeNotes', notes.trim());

      const res = await fetch('/api/activities/create', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: fd,
      });
      const json = await res.json().catch(() => ({ ok: false, error: 'Server error' }));
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Could not save');
        return;
      }
      setOpen(false);
      setFlash(status === 'completed' ? 'Activity logged ✓' : 'Activity scheduled ✓');
      reset();
      router.refresh(); // flow into dashboard / meetings / ward views
      setTimeout(() => setFlash(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Quick add an activity"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand-burnt px-5 py-3 text-sm font-bold text-white shadow-xl hover:bg-brand-rust transition"
      >
        <span className="text-lg leading-none">＋</span>
        <span className="hidden sm:inline">Quick Add</span>
      </button>

      {/* Success flash */}
      {flash && (
        <div className="fixed bottom-20 right-5 z-50 rounded-lg border border-brand-success/50 bg-brand-success/15 px-4 py-2 text-sm font-semibold text-brand-success shadow-lg">
          {flash}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="w-full sm:max-w-lg max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl border border-brand-border bg-brand-cardBg p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-brand-textActive">⚡ Quick Add Activity</h2>
              <button type="button" onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-border text-brand-textMuted hover:text-brand-textActive" aria-label="Close">✕</button>
            </div>

            {/* Planned vs Completed */}
            <div className="grid grid-cols-2 gap-2">
              <ToggleBtn active={status === 'planned'} onClick={() => setStatus('planned')} label="📅 Plan ahead" />
              <ToggleBtn active={status === 'completed'} onClick={() => setStatus('completed')} label="✅ Log done" />
            </div>

            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>

            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Baraza with Kongowea elders"
                maxLength={200}
                className={inputCls}
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={status === 'completed' ? 'When it happened' : 'When'}>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Ward">
                <select value={wardId} onChange={(e) => setWardId(e.target.value)} className={inputCls}>
                  <option value="">Constituency-wide</option>
                  {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Location (optional)">
              <input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Venue / area / village" maxLength={200} className={inputCls} />
            </Field>

            {status === 'completed' ? (
              <div className="grid grid-cols-2 gap-3 items-end">
                <Field label="Turnout">
                  <input type="number" min={0} value={actual} onChange={(e) => setActual(e.target.value)} placeholder="people reached" className={inputCls} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-brand-textBody pb-2">
                  <input type="checkbox" checked={candidateAttended} onChange={(e) => setCandidateAttended(e.target.checked)} className="accent-brand-burnt h-4 w-4" />
                  Candidate attended
                </label>
              </div>
            ) : (
              <Field label="Expected turnout (optional)">
                <input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="estimated people" className={inputCls} />
              </Field>
            )}

            <Field label={status === 'completed' ? 'Outcome / notes' : 'Agenda / notes (optional)'}>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} className={inputCls} placeholder={status === 'completed' ? 'What happened, promises, follow-ups…' : 'Purpose, who to invite…'} />
            </Field>

            {error && <p className="text-xs font-semibold text-brand-danger">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-textMuted hover:text-brand-textActive">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-brand-burnt px-4 py-2 text-sm font-bold text-white hover:bg-brand-rust disabled:opacity-60 transition">
                {busy ? 'Saving…' : status === 'completed' ? 'Log activity' : 'Schedule activity'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const inputCls =
  'w-full rounded-lg border border-brand-border bg-brand-field px-3 py-2 text-sm text-brand-textActive focus:border-brand-burnt focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-textMuted">{label}</span>
      {children}
    </label>
  );
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-3 py-2 text-sm font-bold transition',
        active ? 'border-brand-burnt bg-brand-burnt/15 text-brand-burnt' : 'border-brand-border text-brand-textMuted hover:text-brand-textActive',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
