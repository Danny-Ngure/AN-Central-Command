'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

// The "+ Add" hub wizard. Deliberately layman-first:
//   • one big colour-coded tile per thing you can add (no jargon)
//   • one clean single-column form at a time (never 20 boxes at once)
//   • the Save button stays locked until the few *required* boxes are filled
//   • Ward → Village cascade (pick the ward, only that ward's villages show)
//   • phone boxes open the number pad on a phone (inputMode="tel")
//   • what you add pops into a colour-tagged list immediately, for confidence

type Ward = { id: string; name: string };
type Village = { id: string; name: string };
type Kind = 'church' | 'mosque' | 'polling' | 'team';

const TILES: {
  kind: Kind;
  label: string;
  emoji: string;
  color: string;      // tag / accent colour
  tint: string;       // faint background
  blurb: string;
  leaderWord: string; // what we call the contact person
}[] = [
  { kind: 'church',  label: 'Church',          emoji: '⛪', color: '#2563EB', tint: '#2563EB14', blurb: 'A church and its pastor',        leaderWord: 'Pastor' },
  { kind: 'mosque',  label: 'Mosque',          emoji: '🕌', color: '#059669', tint: '#05966914', blurb: 'A mosque and its imam',         leaderWord: 'Imam' },
  { kind: 'polling', label: 'Polling Station', emoji: '🗳️', color: '#7C3AED', tint: '#7C3AED14', blurb: 'An IEBC polling centre',        leaderWord: 'Contact' },
  { kind: 'team',    label: 'Team Member',     emoji: '🧑🏽', color: '#CA8A04', tint: '#CA8A0414', blurb: 'Someone on the campaign team', leaderWord: 'Name' },
];

const inputClass =
  'w-full min-h-[48px] rounded-lg border border-brand-border bg-brand-field px-3 py-2 text-base text-brand-textActive focus:border-brand-burnt focus:outline-none focus:ring-2 focus:ring-brand-burnt/30';

type Added = { key: string; kind: Kind; name: string; subtitle: string; color: string };

export function AddHub({
  wards,
  villagesByWard,
  canAddTeam,
  canAddPolling,
  defaultWardId,
}: {
  wards: Ward[];
  villagesByWard: Record<string, Village[]>;
  canAddTeam: boolean;
  canAddPolling: boolean;
  defaultWardId: string | null;
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [added, setAdded] = useState<Added[]>([]);

  const tiles = TILES.filter(
    (t) => (t.kind !== 'team' || canAddTeam) && (t.kind !== 'polling' || canAddPolling),
  );
  const active = TILES.find((t) => t.kind === kind) ?? null;

  function onSaved(item: Added) {
    setAdded((prev) => [item, ...prev]);
  }

  function exportCsv() {
    if (added.length === 0) return;
    const rows = [
      ['Type', 'Name', 'Details'],
      ...added.map((a) => [labelOf(a.kind), a.name, a.subtitle]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'added-this-session.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Excel row — always visible, per the spec (export live list / bulk import). */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportCsv}
          disabled={added.length === 0}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-brand-borderStrong bg-brand-cardBg px-4 py-2 text-sm font-semibold text-brand-textActive shadow-sm transition hover:border-brand-burnt hover:text-brand-burnt disabled:cursor-not-allowed disabled:opacity-50"
        >
          ⬇️ Download Excel {added.length > 0 && `(${added.length})`}
        </button>
        <Link
          href="/data-import"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-brand-borderStrong bg-brand-cardBg px-4 py-2 text-sm font-semibold text-brand-textActive shadow-sm transition hover:border-brand-burnt hover:text-brand-burnt"
        >
          ⬆️ Upload Excel file
        </Link>
      </div>

      {/* Step 1 — pick a category (big colour tiles). */}
      {!active && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tiles.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => setKind(t.kind)}
              className="group flex min-h-[88px] items-center gap-4 rounded-2xl border-2 p-4 text-left shadow-sm transition hover:shadow-md active:scale-[0.99]"
              style={{ borderColor: `${t.color}55`, backgroundColor: t.tint }}
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl"
                style={{ backgroundColor: `${t.color}22` }}
              >
                {t.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-extrabold text-brand-textActive">{t.label}</span>
                <span className="block text-sm text-brand-textMuted">{t.blurb}</span>
              </span>
              <span className="ml-auto text-2xl font-bold" style={{ color: t.color }}>
                +
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — the form for the chosen category. */}
      {active && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setKind(null)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-brand-borderStrong bg-brand-cardBg px-3 py-2 text-sm font-semibold text-brand-textActive shadow-sm transition hover:border-brand-burnt hover:text-brand-burnt"
          >
            ← Choose something else
          </button>

          <div
            className="rounded-2xl border-2 p-5"
            style={{ borderColor: `${active.color}55`, backgroundColor: active.tint }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-lg text-2xl"
                style={{ backgroundColor: `${active.color}22` }}
              >
                {active.emoji}
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-brand-textActive">Add a {active.label}</h2>
                <p className="text-xs text-brand-textMuted">Boxes marked (Required) must be filled.</p>
              </div>
            </div>

            {active.kind === 'team' ? (
              <TeamForm wards={wards} defaultWardId={defaultWardId} color={active.color} onSaved={onSaved} />
            ) : active.kind === 'polling' ? (
              <PollingForm wards={wards} defaultWardId={defaultWardId} color={active.color} onSaved={onSaved} />
            ) : (
              <SiteForm
                kind={active.kind}
                leaderWord={active.leaderWord}
                wards={wards}
                villagesByWard={villagesByWard}
                defaultWardId={defaultWardId}
                color={active.color}
                onSaved={onSaved}
              />
            )}
          </div>
        </div>
      )}

      {/* Live list — what you added this session. */}
      <LiveList added={added} />
    </div>
  );
}

// ── Shared field wrapper ────────────────────────────────────────────────────
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1.5 text-sm font-semibold text-brand-textActive">
        {label}
        {required && <span className="text-xs font-bold text-brand-rust">(Required)</span>}
        {hint && <span className="text-xs font-normal text-brand-textMuted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SaveBar({
  color,
  disabled,
  saving,
  label,
}: {
  color: string;
  disabled: boolean;
  saving: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || saving}
      className="mt-1 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-5 text-base font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[220px]"
      style={{ backgroundColor: color }}
    >
      {saving ? 'Saving…' : `✓ ${label}`}
    </button>
  );
}

function Flash({ msg }: { msg: string | null }) {
  if (!msg) return null;
  const isError = msg.startsWith('!');
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
        isError
          ? 'bg-brand-danger/10 text-brand-danger'
          : 'bg-brand-success/10 text-brand-success'
      }`}
    >
      {isError ? msg.slice(1) : msg}
    </p>
  );
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success !== false) return { ok: true };
    return { ok: false, error: json?.error?.message ?? 'Could not save. Please try again.' };
  } catch {
    return { ok: false, error: 'Network problem — check your connection and try again.' };
  }
}

// ── Church / Mosque form ────────────────────────────────────────────────────
function SiteForm({
  kind,
  leaderWord,
  wards,
  villagesByWard,
  defaultWardId,
  color,
  onSaved,
}: {
  kind: 'church' | 'mosque';
  leaderWord: string;
  wards: Ward[];
  villagesByWard: Record<string, Village[]>;
  defaultWardId: string | null;
  color: string;
  onSaved: (a: Added) => void;
}) {
  const [name, setName] = useState('');
  const [leader, setLeader] = useState('');
  const [phone, setPhone] = useState('');
  const [wardId, setWardId] = useState(defaultWardId ?? '');
  const [villageId, setVillageId] = useState('');
  const [area, setArea] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const villages = useMemo(() => (wardId ? villagesByWard[wardId] ?? [] : []), [wardId, villagesByWard]);
  const ready = name.trim() && leader.trim() && phone.trim() && wardId && villageId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setFlash(null);
    const r = await postJson('/api/sites', {
      type: kind,
      name: name.trim(),
      wardId,
      villageId,
      contactPersonName: leader.trim(),
      contactPhone: phone.trim(),
      contactRole: leaderWord,
      areaName: area.trim() || null,
    });
    setSaving(false);
    if (!r.ok) {
      setFlash('!' + (r.error ?? 'Could not save.'));
      return;
    }
    const wardName = wards.find((w) => w.id === wardId)?.name ?? '';
    const villageName = villages.find((v) => v.id === villageId)?.name ?? '';
    onSaved({
      key: `${kind}-${name}-${Date.now()}`,
      kind,
      name: name.trim(),
      subtitle: `${leaderWord}: ${leader.trim()} · 📞 ${phone.trim()} · ${wardName}${villageName ? ` › ${villageName}` : ''}`,
      color,
    });
    setFlash(`Saved “${name.trim()}” ✓`);
    // Keep the ward for fast repeat entry; clear the rest.
    setName('');
    setLeader('');
    setPhone('');
    setVillageId('');
    setArea('');
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={`${kind === 'church' ? 'Church' : 'Mosque'} name`} required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Freretown Baptist Church" maxLength={200} />
      </Field>
      <Field label={`${leaderWord}'s name`} required>
        <input className={inputClass} value={leader} onChange={(e) => setLeader(e.target.value)} placeholder="e.g. John Doe" maxLength={120} />
      </Field>
      <Field label={`${leaderWord}'s phone`} required hint="opens the number pad">
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" type="tel" placeholder="0712 345 678" maxLength={20} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Ward" required>
          <select className={inputClass} value={wardId} onChange={(e) => { setWardId(e.target.value); setVillageId(''); }}>
            <option value="">Choose a ward…</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Village" required hint={wardId ? undefined : 'pick a ward first'}>
          <select className={inputClass} value={villageId} onChange={(e) => setVillageId(e.target.value)} disabled={!wardId}>
            <option value="">{wardId ? 'Choose a village…' : '— choose a ward first —'}</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Area / landmark" hint="optional">
        <input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. near the market" maxLength={200} />
      </Field>
      <Flash msg={flash} />
      <SaveBar color={color} disabled={!ready} saving={saving} label={`Save ${kind === 'church' ? 'Church' : 'Mosque'}`} />
    </form>
  );
}

// ── Polling station form ────────────────────────────────────────────────────
function PollingForm({
  wards,
  defaultWardId,
  color,
  onSaved,
}: {
  wards: Ward[];
  defaultWardId: string | null;
  color: string;
  onSaved: (a: Added) => void;
}) {
  const [name, setName] = useState('');
  const [wardId, setWardId] = useState(defaultWardId ?? '');
  const [voters, setVoters] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const ready = name.trim() && wardId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setFlash(null);
    const r = await postJson('/api/polling-stations', {
      name: name.trim(),
      wardId,
      registeredVoters: voters.trim() ? Number(voters.trim()) : null,
      iebcCode: code.trim() || null,
    });
    setSaving(false);
    if (!r.ok) {
      setFlash('!' + (r.error ?? 'Could not save.'));
      return;
    }
    const wardName = wards.find((w) => w.id === wardId)?.name ?? '';
    onSaved({
      key: `polling-${name}-${Date.now()}`,
      kind: 'polling',
      name: name.trim(),
      subtitle: `${wardName}${voters.trim() ? ` · ${Number(voters.trim()).toLocaleString()} voters` : ''}${code.trim() ? ` · ${code.trim()}` : ''}`,
      color,
    });
    setFlash(`Saved “${name.trim()}” ✓`);
    setName('');
    setVoters('');
    setCode('');
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Station name" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mkomani Primary School" maxLength={200} />
      </Field>
      <Field label="Ward" required>
        <select className={inputClass} value={wardId} onChange={(e) => setWardId(e.target.value)}>
          <option value="">Choose a ward…</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Registered voters" hint="optional">
          <input className={inputClass} value={voters} onChange={(e) => setVoters(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" type="tel" placeholder="e.g. 1200" />
        </Field>
        <Field label="IEBC code" hint="optional — added later if unknown">
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 034-01-02" maxLength={40} />
        </Field>
      </div>
      <Flash msg={flash} />
      <SaveBar color={color} disabled={!ready} saving={saving} label="Save Polling Station" />
    </form>
  );
}

// ── Team member form ────────────────────────────────────────────────────────
const TEAM_CATEGORIES = [
  { value: 'ward', label: 'Ward team (grassroots)' },
  { value: 'executive', label: 'Executive (constituency-wide)' },
  { value: 'technical', label: 'Technical (tech / media / comms)' },
  { value: 'warembo', label: 'Warembo wa Alfayo' },
] as const;

function TeamForm({
  wards,
  defaultWardId,
  color,
  onSaved,
}: {
  wards: Ward[];
  defaultWardId: string | null;
  color: string;
  onSaved: (a: Added) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<(typeof TEAM_CATEGORIES)[number]['value']>('ward');
  const [wardId, setWardId] = useState(defaultWardId ?? '');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const needsWard = category === 'ward';
  const ready = name.trim() && phone.trim() && category && (!needsWard || wardId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setFlash(null);
    const fd = new FormData();
    fd.set('fullName', name.trim());
    fd.set('phone', phone.trim());
    fd.set('category', category);
    if (wardId) fd.set('wardId', wardId);
    if (title.trim()) fd.set('title', title.trim());
    let error: string | null = null;
    try {
      const res = await fetch('/api/team/create', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) error = json?.error?.message ?? 'Could not save.';
    } catch {
      error = 'Network problem — check your connection and try again.';
    }
    setSaving(false);
    if (error) {
      setFlash('!' + error);
      return;
    }
    const wardName = wards.find((w) => w.id === wardId)?.name ?? '';
    const catLabel = TEAM_CATEGORIES.find((c) => c.value === category)?.label ?? '';
    onSaved({
      key: `team-${name}-${Date.now()}`,
      kind: 'team',
      name: name.trim(),
      subtitle: `📞 ${phone.trim()} · ${catLabel}${wardName ? ` · ${wardName}` : ''}`,
      color,
    });
    setFlash(`Saved “${name.trim()}” ✓`);
    setName('');
    setPhone('');
    setTitle('');
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Full name" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Wanjiku" maxLength={120} />
      </Field>
      <Field label="Phone" required hint="opens the number pad">
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" type="tel" placeholder="0712 345 678" maxLength={20} />
      </Field>
      <Field label="Which team?" required>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as any)}>
          {TEAM_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Ward" required={needsWard} hint={needsWard ? undefined : 'optional'}>
        <select className={inputClass} value={wardId} onChange={(e) => setWardId(e.target.value)}>
          <option value="">{needsWard ? 'Choose a ward…' : 'Constituency-wide (no ward)'}</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Title / role" hint="optional">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ward Representative" maxLength={120} />
      </Field>
      <Flash msg={flash} />
      <SaveBar color={color} disabled={!ready} saving={saving} label="Save Team Member" />
    </form>
  );
}

// ── Live list ───────────────────────────────────────────────────────────────
function labelOf(kind: Kind): string {
  return kind === 'church' ? 'Church' : kind === 'mosque' ? 'Mosque' : kind === 'polling' ? 'Polling Station' : 'Team Member';
}

function LiveList({ added }: { added: Added[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between border-b border-brand-border pb-2">
        <h2 className="text-base font-bold text-brand-textActive">Added just now</h2>
        <span className="text-xs font-semibold text-brand-textMuted">{added.length} this session</span>
      </div>
      {added.length === 0 ? (
        <p className="rounded-xl border border-dashed border-brand-border bg-brand-cardBg/40 px-4 py-6 text-center text-sm text-brand-textMuted">
          Nothing yet — pick a tile above and add your first one. It will show up here instantly.
        </p>
      ) : (
        <ul className="space-y-2">
          {added.map((a) => (
            <li
              key={a.key}
              className="flex items-center gap-3 overflow-hidden rounded-xl border border-brand-border bg-brand-cardBg p-3 shadow-sm"
              style={{ borderLeftWidth: 5, borderLeftColor: a.color }}
            >
              <span
                className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: a.color }}
              >
                {labelOf(a.kind)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold text-brand-textActive">{a.name}</span>
                <span className="block truncate text-xs text-brand-textMuted">{a.subtitle}</span>
              </span>
              <span className="ml-auto shrink-0 text-brand-success" title="Saved">✓</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
