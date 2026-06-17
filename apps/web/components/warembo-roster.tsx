'use client';

// Warembo wa Alfayo registration roster, grouped by ward. Member IDs, photos and
// polling stations are resolved upstream from the canonical registry (one ID per
// person). Clicking a member pops up her membership ID card (feminine rose accent).

import { useState } from 'react';
import { PhoneActions } from './phone-actions';
import { IdCard } from './id-card';

export type WaremboMemberView = {
  name: string;
  phone?: string;
  area?: string;
  id?: string;
  memberId: string;
  photoSrc?: string | null;
  station?: string | null;
  stationCode?: string | null;
};
type Group = { ward: string; members: WaremboMemberView[] };

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
    <img src={src} alt={name} className="h-7 w-7 rounded-full object-cover border border-pink-300/40 shrink-0" />
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500/10 border border-pink-300/30 text-[9px] font-bold text-pink-400">
      {initials}
    </span>
  );
}

export function WaremboRoster({ groups }: { groups: Group[] }) {
  const [selected, setSelected] = useState<(WaremboMemberView & { ward: string }) | null>(null);

  return (
    <div className="mt-4 space-y-6">
      {groups.map((grp) => (
        <div key={grp.ward} className="space-y-2">
          <div className="flex items-baseline justify-between border-b border-pink-300/20 pb-1">
            <h3 className="text-sm font-bold text-brand-textActive">{grp.ward}</h3>
            <span className="text-[11px] font-bold text-brand-gold">{grp.members.length} members</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {grp.members.map((m, i) => {
              const intl = toIntlPhone(m.phone);
              const open = () => setSelected({ ...m, ward: grp.ward.replace(/ Ward$/, '') });
              return (
                <div key={m.id || `${m.name}-${i}`} className="rounded-lg border border-pink-300/20 bg-brand-cardBg/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={open}
                      title={`View ${m.name}'s ID card`}
                      className="flex items-center gap-2 text-left min-w-0 hover:text-pink-400 transition"
                    >
                      <Avatar src={m.photoSrc} name={m.name} />
                      <span className="text-xs font-semibold text-brand-textActive truncate">
                        <span className="text-pink-400/70 font-mono mr-1">{i + 1}.</span>
                        {m.name}
                      </span>
                    </button>
                    {m.area && (
                      <span className="text-[10px] uppercase tracking-wider text-brand-textMuted shrink-0">{m.area}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-end justify-between gap-2 pl-9">
                    <div className="min-w-0">
                      <button type="button" onClick={open} title="View ID card" className="block font-mono text-[10px] font-bold text-brand-gold hover:underline">
                        {m.memberId}
                      </button>
                      {m.id && <span className="block text-[10px] font-mono text-brand-textMuted truncate">ID · {m.id}</span>}
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-pink-500/10 border border-pink-300/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-pink-400/90">
                        🌸 Petal of Alfayo
                      </span>
                    </div>
                    {m.phone ? (
                      <PhoneActions phone={intl ?? m.phone} size="sm" defaultMessage={`Hello ${m.name}, greetings from Team Alfayo Nelson.`} />
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
            className="relative max-h-[92vh] w-full max-w-[480px] overflow-auto rounded-2xl border border-pink-300/30 bg-brand-cardBg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-brand-textActive">{selected.name}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-pink-400">
                  🌸 Petal of Alfayo · {selected.ward}
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
            <IdCard
              variant="member"
              accent="rose"
              fullName={selected.name}
              teamId={selected.memberId}
              roleLabel="Warembo wa Alfayo"
              wardName={selected.ward}
              photoSrc={selected.photoSrc ?? null}
              nationalId={selected.id ?? null}
              phone={toIntlPhone(selected.phone) ?? selected.phone ?? null}
              pollingCentre={selected.station ?? null}
              pollingCode={selected.stationCode ?? null}
            />
            <p className="mt-3 text-center text-[11px] text-brand-textMuted">
              Member ID <span className="font-mono font-bold text-brand-gold">{selected.memberId}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
