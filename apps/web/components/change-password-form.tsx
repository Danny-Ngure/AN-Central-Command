'use client';

import { useState } from 'react';

// Change-password form. POSTs to /api/auth/change-password. New password must be at
// least 12 characters and different from the current one (the server re-checks too).

type Status = { type: 'idle' | 'error' | 'success'; msg: string };

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>({ type: 'idle', msg: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setStatus({ type: 'error', msg: 'The new passwords do not match.' });
      return;
    }
    if (next.length < 12) {
      setStatus({ type: 'error', msg: 'New password must be at least 12 characters.' });
      return;
    }
    setBusy(true);
    setStatus({ type: 'idle', msg: '' });
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setStatus({ type: 'error', msg: data?.error?.message ?? 'Could not change the password.' });
      } else {
        setStatus({ type: 'success', msg: 'Password changed successfully.' });
        setCurrent('');
        setNext('');
        setConfirm('');
      }
    } catch {
      setStatus({ type: 'error', msg: 'Network error — please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue';

  return (
    <form onSubmit={submit} className="rounded-xl border border-brand-border bg-brand-cardBg p-5 space-y-4">
      <Field label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" inputClass={inputClass} />
      <Field label="New password (min 12 characters)" value={next} onChange={setNext} autoComplete="new-password" inputClass={inputClass} />
      <Field label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" inputClass={inputClass} />

      {status.type === 'error' && (
        <p className="text-sm font-semibold text-brand-danger">{status.msg}</p>
      )}
      {status.type === 'success' && (
        <p className="text-sm font-semibold text-brand-success">✓ {status.msg}</p>
      )}

      <button
        type="submit"
        disabled={busy || !current || !next || !confirm}
        className="min-h-[44px] rounded-lg bg-brand-burnt px-5 py-2 text-sm font-bold text-white hover:bg-brand-rust disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {busy ? 'Saving…' : 'Change password'}
      </button>

      <p className="text-[11px] text-brand-textMuted">
        New members start with their <strong>National ID number</strong> as the password — change it here to something
        only you know.
      </p>
    </form>
  );
}

function Field({
  label, value, onChange, autoComplete, inputClass,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  inputClass: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-brand-textMuted block mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          title={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-brand-textMuted hover:text-brand-burnt"
        >
          <EyeIcon off={show} />
        </button>
      </div>
    </div>
  );
}

// Eye (password hidden) / eye with a slash (password visible).
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}
