'use client';

// Full field-team roster for one ward. Member/Agent IDs and photos are resolved
// upstream from the canonical registry (one ID per person), so the same person
// shows the same ID here as anywhere else. Clicking a member pops up her Member +
// Certified Election Agent ID cards.

import { useState } from 'react';
import { PhoneActions } from './phone-actions';
import { IdCard } from './id-card';

export type WardTeamMemberView = {
  name: string;
  id?: string;
  phone?: string;
  village?: string;
  memberId: string;
  agentId: string;
  photoSrc?: string | null;
  station?: string | null;
  stationCode?: string | null;
  votesWard?: string | null;
};

function toIntlPhone(local: string | undefined): string | null {
  const d = (local ?? '').replace(/[^\d]/g, '');
  if (!d) return null;
  if (d.startsWith('254') && d.length === 12) return '+' + d;
  if (d.startsWith('0') && d.length === 10) return '+254' + d.slice(1);
  if (d.length === 9 && (d.startsWith('7') || d.startsWith('1'))) return '+254' + d;
  return null;
}

function Avatar({ src, name }: { src?: string | null; name: string }) {
  const initials = name.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="h-7 w-7 rounded-full object-cover border border-brand-border shrink-0" />
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 border border-brand-teal/30 text-[9px] font-bold text-brand-teal">
      {initials}
    </span>
  );
}

export function WardTeamRoster({ ward, members }: { ward: string; members: WardTeamMemberView[] }) {
  const [selected, setSelected] = useState<WardTeamMemberView | null>(null);
  const matched = members.filter((m) => m.station).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="inline-flex items-baseline gap-2 rounded-xl bg-brand-burnt/10 border-2 border-brand-burnt/40 px-3.5 py-2">
          <span className="text-3xl font-extrabold text-brand-burnt tabular-nums leading-none">{members.length}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-burnt">team members</span>
        </span>
        <span className="text-xs text-brand-textMuted">
          <span className="text-xl font-extrabold text-brand-gold tabular-nums">{matched}</span> matched to a polling station from the IEBC register
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {members.map((m, i) => {
          const intl = toIntlPhone(m.phone);
          return (
            <div key={m.id || `${m.name}-${i}`} className="rounded-lg border border-brand-border bg-brand-cardBg/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  title={`View ${m.name}'s ID cards`}
                  className="flex items-center gap-2 text-left min-w-0 hover:text-brand-burnt transition"
                >
                  <Avatar src={m.photoSrc} name={m.name} />
                  <span className="text-xs font-bold text-brand-textActive truncate">
                    <span className="text-brand-textMuted font-mono mr-1">{i + 1}.</span>
                    {m.name}
                  </span>
                </button>
                {m.village && (
                  <span className="text-[10px] uppercase tracking-wider text-brand-textMuted shrink-0">{m.village}</span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-9">
                <button type="button" onClick={() => setSelected(m)} title="View ID cards" className="font-mono text-[10px] font-bold text-brand-gold hover:underline">
                  {m.memberId}
                </button>
                <span className="font-mono text-[10px] font-bold text-brand-teal">{m.agentId}</span>
                {m.id && <span className="font-mono text-[10px] text-brand-textMuted">ID · {m.id}</span>}
              </div>

              {m.station ? (
                <div className="mt-1 pl-9 text-[10px] text-brand-teal">
                  🗳 Votes at <span className="font-semibold">{m.station}</span>
                  {m.votesWard && m.votesWard !== ward && <span className="text-brand-burnt"> · {m.votesWard} Ward</span>}
                </div>
              ) : (
                <div className="mt-1 pl-9 text-[10px] text-brand-textMuted italic">No IEBC register match yet</div>
              )}

              <div className="mt-1.5 pl-9">
                {m.phone ? (
                  <PhoneActions phone={intl ?? m.phone} size="sm" defaultMessage={`Hello ${m.name}, greetings from Team Alfayo Nelson — ${ward}.`} />
                ) : (
                  <span className="text-[10px] text-brand-textMuted italic">No phone</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelected(null)}>
          <div
            className="relative max-h-[92vh] w-full max-w-[480px] overflow-auto rounded-2xl border border-brand-border bg-brand-cardBg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-brand-textActive">{selected.name}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-burnt">{ward} Ward Team</div>
                {selected.station && (
                  <div className="text-[11px] text-brand-teal mt-0.5">🗳 {selected.station}{selected.stationCode ? ` · ${selected.stationCode}` : ''}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-border text-brand-textMuted hover:border-brand-burnt hover:text-brand-textActive"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-textMuted">Member ID Card</div>
                <IdCard
                  variant="member"
                  fullName={selected.name}
                  teamId={selected.memberId}
                  roleLabel={`${ward} Ward Team`}
                  wardName={ward}
                  photoSrc={selected.photoSrc ?? null}
                  nationalId={selected.id ?? null}
                  phone={toIntlPhone(selected.phone) ?? selected.phone ?? null}
                  agentId={selected.agentId}
                  pollingCentre={selected.station ?? null}
                  pollingCode={selected.stationCode ?? null}
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-textMuted">Certified Election Agent ID</div>
                <IdCard
                  variant="agent"
                  fullName={selected.name}
                  teamId={selected.memberId}
                  roleLabel={`${ward} Ward Team`}
                  wardName={selected.votesWard ?? ward}
                  photoSrc={selected.photoSrc ?? null}
                  nationalId={selected.id ?? null}
                  phone={toIntlPhone(selected.phone) ?? selected.phone ?? null}
                  agentId={selected.agentId}
                  agentStation={selected.station ?? null}
                />
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] text-brand-textMuted">
              Member <span className="font-mono font-bold text-brand-gold">{selected.memberId}</span> · Agent{' '}
              <span className="font-mono font-bold text-brand-teal">{selected.agentId}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
