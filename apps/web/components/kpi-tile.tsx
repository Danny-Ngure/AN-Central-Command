import Link from 'next/link';

// KPI tile primitive. Every dashboard number lives in one of these.
//
// Design intent: each `tone` maps to a distinct ANHF palette band so the
// dashboard reads as a colour-coded ribbon instead of a wall of identical cards.
// Tones reuse the brand tokens directly — no ad-hoc hex values.
//
// Tones (left to right, semantic):
//   teal     — primary brand / structural totals (voters, stations)
//   orange   — high-energy alerts / outreach (phone reach)
//   sky      — informational / live metrics (women %)
//   aqua     — interactive / engagement (men %)
//   deepBlue — secondary aggregates (youth %)
//   amber    — caution
//   success  — positive coverage
//   danger   — danger
//
// All tiles are optionally Link-wrapped via `href` so KPIs become navigation —
// click "Voters" to jump to /voters, "Polling stations" to /wards etc.

export type KpiTone =
  | 'teal'
  | 'orange'
  | 'sky'
  | 'aqua'
  | 'deepBlue'
  | 'amber'
  | 'success'
  | 'danger';

interface Props {
  label: string;
  value: number | string;
  hint?: string;
  tone?: KpiTone;
  icon?: React.ReactNode;
  href?: string;
  delta?: { value: string; positive?: boolean };
}

const TONE: Record<KpiTone, {
  bar: string;       // top accent bar
  tint: string;      // tinted card background (bold, colour-coded)
  border: string;    // coloured border
  glow: string;      // outer shadow on hover
  valueText: string; // big number colour
  iconBg: string;    // icon chip background
  iconText: string;  // icon chip foreground
}> = {
  // Each tone = a distinct, readable retro-sunset colour with a soft tinted card.
  orange:   { bar: 'bg-brand-burnt', tint: 'bg-brand-burnt/[0.10]', border: 'border-brand-burnt/40', glow: 'hover:shadow-brand-teal',   valueText: 'text-brand-burnt', iconBg: 'bg-brand-burnt/20', iconText: 'text-brand-burnt' },
  teal:     { bar: 'bg-brand-teal',  tint: 'bg-brand-teal/[0.10]',  border: 'border-brand-teal/40',  glow: 'hover:shadow-brand-sky',    valueText: 'text-brand-teal',  iconBg: 'bg-brand-teal/20',  iconText: 'text-brand-teal' },
  sky:      { bar: 'bg-brand-rust',  tint: 'bg-brand-rust/[0.10]',  border: 'border-brand-rust/40',  glow: 'hover:shadow-brand-orange', valueText: 'text-brand-rust',  iconBg: 'bg-brand-rust/20',  iconText: 'text-brand-rust' },
  aqua:     { bar: 'bg-brand-brown', tint: 'bg-brand-brown/[0.10]', border: 'border-brand-brown/40', glow: 'hover:shadow-brand-teal',   valueText: 'text-brand-brown', iconBg: 'bg-brand-brown/20', iconText: 'text-brand-brown' },
  deepBlue: { bar: 'bg-brand-olive', tint: 'bg-brand-olive/[0.12]', border: 'border-brand-olive/40', glow: 'hover:shadow-brand-teal',   valueText: 'text-brand-olive', iconBg: 'bg-brand-olive/20', iconText: 'text-brand-olive' },
  amber:    { bar: 'bg-brand-gold',  tint: 'bg-brand-gold/[0.16]',  border: 'border-brand-gold/50',  glow: 'hover:shadow-brand-gold',   valueText: 'text-brand-burnt', iconBg: 'bg-brand-gold/30',  iconText: 'text-brand-burnt' },
  success:  { bar: 'bg-brand-success', tint: 'bg-brand-success/[0.10]', border: 'border-brand-success/40', glow: '',                     valueText: 'text-brand-success', iconBg: 'bg-brand-success/20', iconText: 'text-brand-success' },
  danger:   { bar: 'bg-brand-danger',  tint: 'bg-brand-danger/[0.10]',  border: 'border-brand-danger/40',  glow: '',                     valueText: 'text-brand-danger',  iconBg: 'bg-brand-danger/20',  iconText: 'text-brand-danger' },
};

export function KpiTile({ label, value, hint, tone = 'teal', icon, href, delta }: Props) {
  const t = TONE[tone];
  const body = (
    <div
      className={[
        'group relative overflow-hidden rounded-xl border-2 bg-brand-cardBg',
        t.border,
        'transition shadow-sm hover:shadow-md hover:-translate-y-0.5',
        t.glow,
        href ? 'cursor-pointer' : '',
      ].join(' ')}
    >
      {/* Bold tinted wash — colour-coded card */}
      <div className={`absolute inset-0 ${t.tint} pointer-events-none`} />
      {/* Top accent bar — full-strength colour band */}
      <div className={`absolute inset-x-0 top-0 h-1.5 ${t.bar}`} />

      <div className="relative p-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-brand-textMuted font-bold">
            {label}
          </div>
          {icon && (
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${t.iconBg} ${t.iconText}`}>
              {icon}
            </div>
          )}
        </div>

        <div className={`mt-1.5 text-3xl md:text-4xl font-black tabular-nums ${t.valueText} leading-none`}>
          {value}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          {hint && (
            <div className="text-[11px] text-brand-textMuted truncate">{hint}</div>
          )}
          {delta && (
            <span
              className={[
                'text-[10px] font-bold rounded px-1.5 py-0.5',
                delta.positive
                  ? 'bg-brand-success/15 text-brand-success'
                  : 'bg-brand-danger/15 text-brand-danger',
              ].join(' ')}
            >
              {delta.positive ? '▲' : '▼'} {delta.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-brand-skyBlue/50 rounded-xl">
        {body}
      </Link>
    );
  }
  return body;
}

// ----- Mini SVG icon set, sized for the icon chip ----------------------------

export const KpiIcons = {
  Users: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7a4 4 0 01-3 3.87" />
    </svg>
  ),
  Phone: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.97.36 1.93.68 2.85a2 2 0 01-.45 2.11L8.09 10.09a16 16 0 006 6l1.41-1.41a2 2 0 012.11-.45c.92.32 1.88.55 2.85.68A2 2 0 0122 16.92z" />
    </svg>
  ),
  Pin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Male: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="14" r="6" />
      <path d="M19 5l-5.5 5.5M14 5h5v5" />
    </svg>
  ),
  Female: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7M9 19h6" />
    </svg>
  ),
  Spark: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" />
    </svg>
  ),
  Check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  ),
  Building: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01" />
    </svg>
  ),
  Calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
};
