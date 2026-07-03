'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Global "search everything" command palette.
//
// A subtle trigger sits in the header (visible but not shouting). Clicking it —
// or pressing Cmd/Ctrl+K, or "/" — opens a modal where the user can type to jump
// to any service, with big quick-access buttons for the critical areas shown up
// front. Enter goes to the top match; Escape closes. Keeps first-timers from ever
// feeling lost.

type Dest = { label: string; href: string; hint?: string; critical?: boolean };

const DESTS: Dest[] = [
  { label: 'Home', href: '/dashboard', hint: 'Dashboard overview', critical: true },
  { label: 'Wards', href: '/wards', hint: 'All 5 wards', critical: true },
  { label: 'Voters', href: '/voters', hint: 'Search the register', critical: true },
  { label: 'Polling Centres', href: '/polling-stations', hint: '30 centres · 158 stations', critical: true },
  { label: 'Team', href: '/team', hint: 'Full directory', critical: true },
  { label: 'Analysis & Polls', href: '/analytics', hint: 'Results & demographics', critical: true },
  { label: 'Villages', href: '/villages', hint: 'All-villages map' },
  { label: 'Executive Team', href: '/team?group=executive' },
  { label: 'Ward Teams', href: '/team?group=wards' },
  { label: 'Warembo wa Alfayo', href: '/team?group=warembo' },
  { label: 'Alfayo Flames', href: '/team?group=flames' },
  { label: 'Schedule a meeting', href: '/meetings?action=plan' },
  { label: 'Data Import', href: '/data-import' },
  { label: 'Audit Logs', href: '/audit' },
];

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard: Cmd/Ctrl+K or "/" opens; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !inField && !open)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ('');
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { clearTimeout(t); document.body.style.overflow = prev; };
    }
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return DESTS;
    return DESTS.filter((d) => d.label.toLowerCase().includes(s) || (d.hint ?? '').toLowerCase().includes(s));
  }, [q]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  return (
    <>
      {/* Subtle trigger in the header */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the app"
        className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-cardBg/70 px-2.5 py-1.5 text-xs font-semibold text-brand-textMuted hover:text-brand-textActive hover:border-brand-burnt/50 transition"
      >
        <SearchIcon />
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden lg:inline text-[10px] font-mono bg-black/5 border border-brand-border rounded px-1 py-0.5">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[12vh]"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-brand-borderStrong bg-brand-cardBg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); if (results[0]) go(results[0].href); }}
              className="flex items-center gap-2 border-b border-brand-border px-4 py-3"
            >
              <SearchIcon />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search pages & services…"
                className="flex-1 bg-transparent text-sm text-brand-textActive placeholder:text-brand-textMuted focus:outline-none"
              />
              <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-mono text-brand-textMuted border border-brand-border rounded px-1.5 py-0.5">
                Esc
              </button>
            </form>

            {/* Quick critical-area buttons (only when not searching) */}
            {!q.trim() && (
              <div className="px-4 pt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-2">Go to</div>
                <div className="grid grid-cols-3 gap-2">
                  {DESTS.filter((d) => d.critical).map((d) => (
                    <button
                      key={d.href}
                      type="button"
                      onClick={() => go(d.href)}
                      className="min-h-[44px] rounded-lg border border-brand-border bg-brand-cardBgHeavy/40 px-2 py-2 text-xs font-semibold text-brand-textActive hover:border-brand-burnt hover:text-brand-burnt hover:bg-brand-burnt/5 transition"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results list */}
            <ul className="max-h-[46vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-brand-textMuted">No matches. Try “voters”, “team”, or “polling”.</li>
              )}
              {results.map((d) => (
                <li key={d.href}>
                  <button
                    type="button"
                    onClick={() => go(d.href)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-brand-burnt/10 transition"
                  >
                    <span className="text-sm font-semibold text-brand-textActive">{d.label}</span>
                    {d.hint && <span className="text-[11px] text-brand-textMuted truncate">{d.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
