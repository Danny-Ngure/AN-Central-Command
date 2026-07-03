'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// SUPER-ADMIN-ONLY (Dan) delete control. Destructive, so it uses a deliberate two-step
// confirmation: click Delete, then confirm the person's name. Soft-delete on the server
// keeps history and allows recovery.

export function AdminDeleteUser({ personId, name }: { personId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function doDelete() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/team/${personId}/delete`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message ?? 'Could not delete this user.');
        setBusy(false);
        return;
      }
      router.push('/team');
      router.refresh();
    } catch {
      setError('Network problem — please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-danger/40 bg-brand-danger/[0.06] p-4">
      <div className="flex items-center gap-2">
        <span className="text-base">🗑️</span>
        <h3 className="text-sm font-bold text-brand-textActive">Super Admin — delete this user</h3>
      </div>
      <p className="mt-1 text-xs text-brand-textMuted">
        Removes {name}&rsquo;s access and hides them from the directory. Their history is kept and the
        account can be restored later. Only you (Dan) can do this, and it is recorded in the audit log.
      </p>

      {error && <p className="mt-2 text-sm font-semibold text-brand-danger">{error}</p>}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-brand-danger/60 px-4 py-2 text-sm font-bold text-brand-danger transition hover:bg-brand-danger hover:text-white"
        >
          Delete user
        </button>
      ) : (
        <div className="mt-3 rounded-lg border border-brand-danger/40 bg-black/10 p-3">
          <p className="text-sm font-semibold text-brand-textActive">
            Are you sure you want to delete <span className="text-brand-danger">{name}</span>? They will
            no longer be able to sign in.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={doDelete}
              disabled={busy}
              className="min-h-[40px] rounded-lg bg-brand-danger px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : `Yes, delete ${name.split(' ')[0]}`}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="min-h-[40px] rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold text-brand-textMuted hover:text-brand-textActive"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
