'use client';

import { useEffect, useState } from 'react';

// Election Countdown Widget (SRS FR-090).
//
// AC-090.1 — visible on every Central Command page (mounted in components/navbar.tsx).
// AC-090.2 — election date configurable via NEXT_PUBLIC_ELECTION_DATE env var.
// AC-090.3 — when the date passes, displays "Election day" then "N days since election".
//
// Note: ticks once per second client-side. The 1Hz re-render is scoped to this single
// small component, not the whole navbar — React only re-renders the subtree below
// the state change, and the rest of the navbar is server-rendered.

// 06:00 EAT on 9 August 2027 — polls open in Kenya.
const DEFAULT_ELECTION_DATE = '2027-08-09T03:00:00.000Z';

const ELECTION_DATE = new Date(
  process.env.NEXT_PUBLIC_ELECTION_DATE ?? DEFAULT_ELECTION_DATE,
);

interface Parts {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  passed: boolean;
}

function diffParts(now: Date): Parts {
  const ms = ELECTION_DATE.getTime() - now.getTime();
  const passed = ms <= 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs / 3_600_000) % 24);
  const mins = Math.floor((abs / 60_000) % 60);
  const secs = Math.floor((abs / 1_000) % 60);
  return { days, hours, mins, secs, passed };
}

export function Countdown() {
  // null on first server render → renders a safe placeholder.
  // useEffect populates the real value client-side and starts the ticker.
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    setParts(diffParts(new Date()));
    const id = setInterval(() => setParts(diffParts(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  if (!parts) {
    // Pre-hydration placeholder — keeps server and client markup consistent.
    return (
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">
        <span>Election countdown</span>
        <span className="text-brand-textActive">—</span>
      </div>
    );
  }

  if (parts.passed) {
    if (parts.days === 0 && parts.hours < 24) {
      return (
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan">
            Election day
          </span>
        </div>
      );
    }
    return (
      <div className="text-xs text-brand-textMuted">
        {parts.days} day{parts.days === 1 ? '' : 's'} since election
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">
        Election in
      </div>
      <div className="flex items-center gap-1.5 text-brand-textActive font-mono text-xs">
        <Cell value={parts.days} unit="d" />
        <Cell value={parts.hours} unit="h" pad />
        <Cell value={parts.mins} unit="m" pad />
        <Cell value={parts.secs} unit="s" pad />
      </div>
    </div>
  );
}

function Cell({ value, unit, pad }: { value: number; unit: string; pad?: boolean }) {
  const text = pad ? String(value).padStart(2, '0') : String(value);
  return (
    <span>
      <span className="font-bold tabular-nums">{text}</span>
      <span className="text-brand-textMuted ml-0.5">{unit}</span>
    </span>
  );
}
