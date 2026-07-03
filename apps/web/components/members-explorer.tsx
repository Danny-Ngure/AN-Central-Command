'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PhoneActions } from './phone-actions';

// Client-side members explorer. Each group (Ward team / Warembo / Flames) is a big
// bar with the total, a row of TABS on top, and the selected tab's members listed
// inline below. Switching tabs is instant — no navigation, no page reload.

export interface ExplorerRow {
  key: string;
  name: string;
  photo: string | null;
  memberId: string | null;
  subtitle: string;
  ward: string | null;
  phone: string | null;
  nationalId: string | null;
  station: string | null;
  stationCode: string | null;
  isSuper: boolean;
  profileHref: string | null;
}

export interface ExplorerGroup {
  big: number;
  unit: string;
  accent: string;
  tabs: { key: string; label: string; count: number }[];
  rowsByTab: Record<string, ExplorerRow[]>;
}

export function MembersExplorer({ groups }: { groups: ExplorerGroup[] }) {
  return (
    <div className="space-y-5">
      {groups.map((g, i) => <GroupSection key={i} g={g} />)}
    </div>
  );
}

function GroupSection({ g }: { g: ExplorerGroup }) {
  const [tab, setTab] = useState(g.tabs[0]?.key ?? '');
  const active = g.tabs.find((t) => t.key === tab) ?? g.tabs[0];
  const rows = g.rowsByTab[tab] ?? [];

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-cardBg overflow-hidden">
      {/* Header: big number + tabs */}
      <div className="p-5 flex items-center gap-5 flex-wrap border-b border-brand-border">
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-6xl font-extrabold tabular-nums leading-none" style={{ color: g.accent }}>{g.big}</span>
          <span className="text-sm font-bold uppercase tracking-wide text-brand-textActive leading-tight max-w-[7rem]">{g.unit}</span>
        </div>
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {g.tabs.map((t) => {
            const on = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 transition select-none shadow-sm active:scale-[0.97]',
                  on
                    ? 'bg-brand-burnt border-brand-burnt'
                    : 'bg-brand-cardBg border-brand-borderStrong hover:border-brand-burnt hover:bg-brand-burnt/10',
                ].join(' ')}
              >
                <span className={`text-lg font-extrabold tabular-nums leading-none ${on ? 'text-white' : 'text-brand-textActive'}`}>{t.count}</span>
                <span className={`text-xs font-semibold ${on ? 'text-white/90' : 'text-brand-textBody'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected tab label */}
      <div className="px-5 py-2.5 bg-brand-cardBgHeavy/40 border-b border-brand-border flex items-baseline justify-between gap-2">
        <span className="text-sm font-extrabold uppercase tracking-wider text-brand-textActive">{active?.label}</span>
        <span className="inline-flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-brand-burnt tabular-nums leading-none">{rows.length}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">members</span>
        </span>
      </div>

      {/* Members list */}
      <div className="divide-y divide-black/5">
        {rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-brand-textMuted italic">No members in this list yet.</div>
        ) : (
          rows.map((r, i) => <MemberRow key={`${r.key}:${i}`} n={i + 1} r={r} />)
        )}
      </div>
    </div>
  );
}

function MemberRow({ r, n }: { r: ExplorerRow; n: number }) {
  const initials = r.name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return (
    <details className="group">
      <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-black/5 list-none">
        <span className="w-7 shrink-0 text-right text-base font-extrabold text-brand-textMuted tabular-nums">{n}.</span>
        {r.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photo} alt="" className="w-12 h-12 rounded-full object-cover border border-brand-border shrink-0" />
        ) : (
          <span className="w-12 h-12 rounded-full bg-brand-teal/15 text-brand-teal flex items-center justify-center text-sm font-bold shrink-0">{initials}</span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-base font-bold text-brand-textActive truncate">
            {r.name}
          </span>
          <span className="block text-xs text-brand-textMuted truncate">{r.subtitle}{r.ward ? ` · ${r.ward}` : ''}</span>
        </span>
        {r.memberId && (
          <span className="shrink-0 rounded-md bg-brand-burnt/10 border border-brand-burnt/30 px-2.5 py-1 text-xs font-mono font-bold text-brand-burnt">{r.memberId}</span>
        )}
        <svg className="w-5 h-5 text-brand-textMuted transition-transform group-open:rotate-180 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-4 pb-4 pl-[4.5rem] text-sm text-brand-textBody">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          <div><span className="text-brand-textMuted">Member ID:</span> <span className="font-mono font-bold text-brand-textActive">{r.memberId ?? '—'}</span></div>
          <div><span className="text-brand-textMuted">Role:</span> {r.subtitle}</div>
          {r.ward && <div><span className="text-brand-textMuted">Ward:</span> {r.ward}</div>}
          <div><span className="text-brand-textMuted">National ID:</span> {r.nationalId ?? '—'}</div>
          {r.station && (
            <div className="sm:col-span-2"><span className="text-brand-textMuted">Votes at:</span> {r.station}{r.stationCode ? ` (${r.stationCode})` : ''}</div>
          )}
          {r.phone && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <span className="text-brand-textMuted">Phone:</span>
              <span className="font-mono">{r.phone}</span>
              <PhoneActions phone={r.phone} size="sm" />
            </div>
          )}
        </div>
        {r.profileHref && (
          <div className="pt-2">
            <Link href={r.profileHref} className="text-xs font-semibold text-brand-tealBlue hover:text-brand-burnt">View 360 profile →</Link>
          </div>
        )}
      </div>
    </details>
  );
}
