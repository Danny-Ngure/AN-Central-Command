import { Barcode } from './barcode';
import { Signature } from './signature';
import { IebcLogo } from './iebc-logo';

// Official ANHF ID cards — double-sided (front + back), professionally laid out
// to match the campaign templates.
//   variant="member" → landscape Member ID card
//   variant="agent"  → portrait Certified Election Agent card (with IEBC mark)

export const ORG = {
  name: 'Alfayo Nelson Hope Foundation',
  short: 'ANHF',
  id: 'ANHF-NYALI-2027',
  race: 'MP NYALI RACE · 2027',
  notice:
    'THIS PROPERTY BELONGS TO ALFAYO NELSON HOPE FOUNDATION. IF FOUND MISSING, IT SHOULD BE TREATED AS LOST AND RETURNED TO ALFAYO NELSON HOPE FOUNDATION.',
};

export type IdCardProps = {
  fullName: string;
  teamId: string | null;
  roleLabel: string;
  wardName: string | null;
  photoSrc: string | null;
  nationalId?: string | null;
  phone?: string | null;
  agentId?: string | null;
  agentStation?: string | null;
  pollingCentre?: string | null;
  pollingCode?: string | null;
  variant?: 'member' | 'agent';
};

function AnhfMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-white shadow"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="ANHF" className="object-contain" style={{ width: size - 6, height: size - 6 }} />
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#1e6fc0]">{label}</div>
      <div className="text-sm font-bold text-slate-800">{value || '—'}</div>
    </div>
  );
}

function Notice() {
  return (
    <p className="text-center text-[10px] font-semibold leading-snug text-slate-700 px-2">{ORG.notice}</p>
  );
}

function SignRow() {
  return (
    <div className="grid grid-cols-2 gap-3 px-3">
      <Signature name="Alfayo Nelson" role="Patron · ANHF" src="/sign-alfayo.png" height={34} />
      <Signature name="Benson Imoli" role="CEO · ANHF" src="/sign-benson.png" height={30} />
    </div>
  );
}

/* ───────────────────────── MEMBER (landscape) ───────────────────────── */

function MemberFront(p: IdCardProps) {
  return (
    <CardShell className="aspect-[1.6/1]">
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-[#1c6fb8] to-[#0b2c66] flex items-center justify-between px-3">
        <AnhfMark />
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.12em] text-white">Alfayo Nelson Central Command</span>
      </div>
      <div className="absolute -left-6 bottom-0 w-24 h-24 rounded-full bg-[#1c6fb8]/10" />
      <div className="pt-14 px-4 pb-3 flex gap-4 h-full">
        <PhotoBox src={p.photoSrc} name={p.fullName} className="w-[34%] self-start aspect-[4/5] rounded-xl object-top" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-[#2a5db0] to-[#7b2ff7] bg-clip-text text-transparent">Member ID Card</div>
          <div className="text-base font-black uppercase text-slate-900 leading-tight truncate">{p.fullName}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
            <Field label="Member ID" value={p.teamId ?? '—'} />
            <Field label="ID Number" value={p.nationalId ?? '—'} />
            <Field label="Phone" value={p.phone ?? '—'} />
            <Field label="Ward" value={p.wardName ? p.wardName.toUpperCase() : 'CONSTITUENCY-WIDE'} />
            {p.pollingCentre && <Field label="Polling Station" value={p.pollingCentre} />}
            {p.pollingCode && <Field label="Station Code" value={p.pollingCode} />}
            {p.agentId && p.agentId !== p.teamId && <Field label="Agent ID" value={p.agentId} />}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function MemberBack(p: IdCardProps) {
  return (
    <CardShell className="aspect-[1.6/1]">
      <div className="absolute inset-x-0 top-0 h-9 bg-gradient-to-r from-[#1c6fb8] to-[#0b2c66] flex items-center justify-between px-3">
        <AnhfMark size={24} />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/90">{ORG.name}</span>
      </div>
      <div className="pt-12 pb-3 h-full flex flex-col justify-between">
        <Notice />
        <SignRow />
        <div className="px-4">
          <div className="rounded bg-white p-1 border border-slate-200">
            <Barcode value={`${ORG.id}|${p.teamId ?? ''}${p.nationalId ? '|' + p.nationalId : ''}`} height={34} />
          </div>
          <div className="text-center text-[9px] font-bold uppercase tracking-widest text-[#1c6fb8] mt-1">{ORG.race}</div>
        </div>
      </div>
    </CardShell>
  );
}

/* ───────────────────────── AGENT (portrait) ───────────────────────── */

function AgentFront(p: IdCardProps) {
  return (
    <CardShell className="aspect-[1/1.66] bg-gradient-to-b from-[#2f9be8] via-[#2487d6] to-[#16548f]">
      <div className="flex items-start justify-between px-3 pt-3">
        <AnhfMark />
        <div className="text-center px-1">
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-white leading-tight">Certified Election Agent</div>
          <div className="font-signature text-lg leading-none text-brand-gold">for Alfayo Nelson</div>
        </div>
        <IebcLogo size={34} />
      </div>
      <div className="px-4 mt-2">
        <PhotoBox src={p.photoSrc} name={p.fullName} className="w-full aspect-[4/5] rounded-lg border-white/70 object-top" />
      </div>
      <div className="px-4 mt-2 text-center text-white">
        <div className="text-base font-black uppercase leading-tight">{p.fullName}</div>
        <div className="text-[10px] font-semibold text-white/85 mt-0.5">{(p.wardName ?? '').toUpperCase()}{p.agentStation ? ` · ${p.agentStation.toUpperCase()} AGENT` : ''}</div>
        <div className="mt-1 inline-block rounded bg-black/25 px-3 py-1">
          <span className="text-[9px] uppercase tracking-widest text-white/60">Agent ID </span>
          <span className="text-sm font-black text-brand-gold tracking-widest">{p.agentId}</span>
        </div>
        <div className="text-[10px] text-white/80 mt-1">ID NO: {p.nationalId ?? '—'}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-[#0f4a82] py-1.5 text-center">
        <div className="text-[10px] font-black uppercase tracking-widest text-white">Alfayo Nelson</div>
        <div className="text-[8px] text-white/70">{ORG.race}</div>
      </div>
    </CardShell>
  );
}

function AgentBack(p: IdCardProps) {
  return (
    <CardShell className="aspect-[1/1.66] bg-gradient-to-b from-[#dbeeff] to-[#bfe0ff]">
      <div className="pt-4 px-3 flex flex-col h-full gap-3">
        <div className="flex items-center justify-center gap-2">
          <AnhfMark size={26} /><IebcLogo size={26} />
        </div>
        <Notice />
        <SignRow />
        <div className="px-2 mt-auto mb-4">
          <div className="rounded bg-white p-1 border border-slate-200">
            <Barcode value={`${ORG.id}|AGENT|${p.agentId ?? ''}${p.nationalId ? '|' + p.nationalId : ''}`} height={34} />
          </div>
          <div className="text-center text-[8px] font-bold uppercase tracking-widest text-[#16548f] mt-1">{ORG.name}</div>
        </div>
      </div>
    </CardShell>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-xl border border-black/10 bg-white ${className}`} style={{ minWidth: 260 }}>
      {children}
    </div>
  );
}

function PhotoBox({ src, name, className = '' }: { src: string | null; name: string; className?: string }) {
  const initials = name.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className={`object-cover border-2 border-white shadow ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-slate-200 text-slate-500 text-2xl font-black border-2 border-white ${className}`}>{initials}</div>
  );
}

export function IdCard(props: IdCardProps) {
  const variant = props.variant ?? 'member';
  const [Front, Back] = variant === 'agent' ? [AgentFront, AgentBack] : [MemberFront, MemberBack];
  const w = variant === 'agent' ? 'w-[280px]' : 'w-[420px] max-w-full';
  return (
    <div className="flex flex-wrap gap-5 justify-center">
      <div className={w}><div className="text-[10px] font-bold uppercase tracking-widest text-brand-textMuted mb-1 text-center">Front</div><Front {...props} /></div>
      <div className={w}><div className="text-[10px] font-bold uppercase tracking-widest text-brand-textMuted mb-1 text-center">Back</div><Back {...props} /></div>
    </div>
  );
}
