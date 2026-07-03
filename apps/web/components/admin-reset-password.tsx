'use client';

import { useState } from 'react';

// SUPER-ADMIN-ONLY control (rendered only for Dan). Resets a member's password to a
// fresh temporary one and shows it once so Dan can pass it on. The member is forced to
// set their own password on next login.

export function AdminResetPassword({ personId, name }: { personId: string; name: string }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'working' | 'done' | 'error'>('idle');
  const [temp, setTemp] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function doReset() {
    setState('working');
    setError('');
    try {
      const res = await fetch(`/api/team/${personId}/reset-password`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message ?? 'Could not reset the password.');
        setState('error');
        return;
      }
      setTemp(json.data.tempPassword);
      setState('done');
    } catch {
      setError('Network problem — please try again.');
      setState('error');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(temp);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the value is on screen to copy manually */
    }
  }

  return (
    <div className="rounded-xl border border-brand-rust/40 bg-brand-rust/[0.06] p-4">
      <div className="flex items-center gap-2">
        <span className="text-base">🔑</span>
        <h3 className="text-sm font-bold text-brand-textActive">Super Admin — reset this member&rsquo;s password</h3>
      </div>
      <p className="mt-1 text-xs text-brand-textMuted">
        Use this if {name.split(' ')[0]} forgot their password. It sets a new temporary password and
        makes them choose their own on next login. Only you (Dan) can do this, and it is recorded in the audit log.
      </p>

      {state === 'idle' && (
        <button
          type="button"
          onClick={() => setState('confirm')}
          className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-rust px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-burnt"
        >
          Reset password
        </button>
      )}

      {state === 'confirm' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-brand-textActive">Reset {name}&rsquo;s password?</span>
          <button type="button" onClick={doReset} className="min-h-[40px] rounded-lg bg-brand-rust px-4 py-2 text-sm font-bold text-white hover:bg-brand-burnt">
            Yes, reset
          </button>
          <button type="button" onClick={() => setState('idle')} className="min-h-[40px] rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold text-brand-textMuted hover:text-brand-textActive">
            Cancel
          </button>
        </div>
      )}

      {state === 'working' && <p className="mt-3 text-sm font-semibold text-brand-textMuted">Resetting…</p>}

      {state === 'done' && (
        <div className="mt-3 rounded-lg border border-brand-success/40 bg-brand-success/10 p-3">
          <p className="text-xs font-semibold text-brand-success">
            Done. Give {name.split(' ')[0]} this temporary password — they&rsquo;ll set their own on next login:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="select-all rounded-md bg-black/25 px-3 py-2 text-base font-bold tracking-wide text-brand-textActive">{temp}</code>
            <button type="button" onClick={copy} className="min-h-[40px] rounded-lg border border-brand-borderStrong px-3 py-2 text-xs font-bold text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt">
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <button type="button" onClick={() => { setState('idle'); setTemp(''); }} className="mt-2 text-xs font-semibold text-brand-textMuted hover:text-brand-textActive">
            Done
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-brand-danger">{error}</p>
          <button type="button" onClick={() => setState('idle')} className="mt-2 text-xs font-semibold text-brand-textMuted hover:text-brand-textActive">
            Back
          </button>
        </div>
      )}
    </div>
  );
}
