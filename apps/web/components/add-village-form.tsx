'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

// Inline "Add village" form for a ward's Villages page. Collapsed by default;
// posts to /api/villages and refreshes the page on success.
export function AddVillageForm({ wardId, wardName }: { wardId: string; wardName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [population, setPopulation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/villages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wardId,
          name,
          populationEstimate: population ? Number(population) : null,
        }),
      });
      const body = await res.json();
      if (body.success) {
        setName('');
        setPopulation('');
        setOpen(false);
        router.refresh();
      } else {
        setError(body.error?.message ?? 'Could not add village');
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
        + Add village
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-brand-borderStrong bg-brand-cardBg p-4 space-y-3 max-w-md">
      <div className="text-sm font-bold text-brand-textActive">Add a village to {wardName}</div>
      <div className="space-y-1">
        <label htmlFor="village-name" className="text-[11px] font-semibold uppercase tracking-wider text-brand-textMuted">
          Village name
        </label>
        <input
          id="village-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder="e.g. Mlaleo"
          className="w-full rounded-lg border border-brand-border bg-brand-field px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-burnt"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="village-pop" className="text-[11px] font-semibold uppercase tracking-wider text-brand-textMuted">
          Population estimate (optional)
        </label>
        <input
          id="village-pop"
          type="number"
          min="0"
          value={population}
          onChange={(e) => setPopulation(e.target.value)}
          placeholder="e.g. 7500"
          className="w-full rounded-lg border border-brand-border bg-brand-field px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-burnt"
        />
      </div>
      {error && <div className="text-xs text-brand-danger bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-burnt px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-rust transition disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save village'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-brand-textMuted hover:text-brand-textActive">
          Cancel
        </button>
      </div>
    </form>
  );
}
