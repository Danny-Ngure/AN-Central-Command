'use client';

// Alfayo Flames rank-and-file roster, grouped by ward. Member/Agent IDs and
// photos are resolved upstream from the canonical registry (one ID per person).
// Clicking a member pops up her Member + Certified Election Agent ID cards.
// Fire-themed (rust / gold) to match the Flames leadership crew.

import { useState } from 'react';
import { PhoneActions } from './phone-actions';
import { IdCard } from './id-card';

export type FlamesRosterMemberView = {
  name: string;
  phone?: string;
  memberId: string;
  agentId: string;
  photoSrc?: string | null;
  station?: string | null;
  stationCode?: string | null;
};
type Group = { ward: string; members: FlamesRosterMemberView[] };

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
    <img src={src} alt={name} className="h-7 w-7 rounded-full object-cover border border-brand-rust/40 shrink-0" />
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-rust/10 border border-brand-rust/30 text-[9px] font-bold text-brand-rust">
      {initials}
    </span>
  );
}

export function FlamesRoster({ groups }: { groups: Group[] }) {
  const [selected, setSelected] = useState<(FlamesRosterMemberView & { ward: string }) | null>(null);

  return (
    <div className="mt-4 space-y-6">
      {groups.map((grp) => (
        <div key={grp.ward} className="space-y-2">
          <div className="flex items-baseline justify-between border-b border-brand-rust/20 pb-1">
            <h3 className="text-sm font-bold text-brand-textActive">{grp.ward}</h3>
            <span className="text-[11px] font-bold text-brand-gold">{grp.members.length} crew</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {grp.members.map((m, i) => {
              const intl = toIntlPhone(m.phone);
              const open = () => setSelected({ ...m, ward: grp.ward.replace(/ Ward$/, '') });
              return (
                <div key={m.phone || `${m.name}-${i}`} className="rounded-lg border border-brand-rust/20 bg-brand-cardBg/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={open}
                      title={`View ${m.name}'s ID cards`}
                      className="flex items-center gap-2 text-left min-w-0 hover:text-brand-rust transition"
                    >
                      <Avatar src={m.photoSrc} name={m.name} />
                      <span className="text-xs font-semibold text-brand-textActive truncate">
                        <span className="text-brand-rust/70 font-mono mr-1">{i + 1}.</span>
                        {m.name}
                      </span>
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-end justify-between gap-2 pl-9">
                    <div className="min-w-0">
                      <button type="button" onClick={open} title="View ID cards" className="block font-mono text-[10px] font-bold text-brand-gold hover:underline">
                        {m.memberId}
                      </button>
                      <span className="block font-mono text-[10px] font-bold text-brand-teal">{m.agentId}</span>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-rust/10 border border-brand-rust/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-brand-rust/90">
                        🔥 Flame of Alfayo
                      </span>
                    </div>
                    {m.phone ? (
                      <PhoneActions phone={intl ?? m.phone} size="sm" defaultMessage={`Hello ${m.name}, greetings from the Alfayo Flames crew.`} />
                    ) : (
                      <span className="text-[10px] text-brand-textMuted italic shrink-0">No phone</span>
                    )}
                  </div>
                  {m.station && (
                    <div className="mt-1 pl-9 text-[10px] text-brand-teal">
                      🗳 Votes at <span className="font-semibold">{m.station}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelected(null)}>
          <div
            className="relative max-h-[92vh] w-full max-w-[480px] overflow-auto rounded-2xl border border-brand-rust/30 bg-brand-cardBg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-brand-textActive">{selected.name}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-rust">
                  🔥 Alfayo Flames · {selected.ward}
                </div>
                {selected.station && (
                  <div className="mt-0.5 text-[11px] text-brand-teal">
                    🗳 {selected.station}{selected.stationCode ? ` · ${selected.stationCode}` : ''}
                  </div>
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
                  roleLabel="Alfayo Flames"
                  wardName={selected.ward}
                  photoSrc={selected.photoSrc ?? null}
                  nationalId={null}
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
                  roleLabel="Alfayo Flames"
                  wardName={selected.ward}
                  photoSrc={selected.photoSrc ?? null}
                  nationalId={null}
                  phone={toIntlPhone(selected.phone) ?? selected.phone ?? null}
                  agentId={selected.agentId}
                  pollingCentre={selected.station ?? null}
                  pollingCode={selected.stationCode ?? null}
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
