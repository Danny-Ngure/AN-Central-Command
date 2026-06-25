// Horizontal bar chart — designed for poll standings (one bar per candidate).
// Each bar fills proportional to value, with the label inside on a coloured pill
// and the percentage at the end.

import Link from 'next/link';

export interface HBarBar {
  label: string;
  value: number;       // 0-100 for %s
  color: string;
  highlight?: boolean; // emphasise (e.g. our candidate)
  sublabel?: string;   // small grey text under the main label
  href?: string;       // when set, the whole row is a link (e.g. → station voters)
}

interface Props {
  bars: HBarBar[];
  max?: number;        // default 100
  showValue?: boolean;
}

export function HorizontalBarChart({ bars, max = 100, showValue = true }: Props) {
  return (
    <div className="space-y-2.5">
      {bars.map((b) => {
        const pct = Math.max(0, Math.min(100, (b.value / max) * 100));
        const inner = (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={`font-semibold ${b.highlight ? 'text-brand-orangeBright' : 'text-brand-textActive'} ${b.href ? 'group-hover:underline' : ''}`}>
                {b.highlight && <span className="mr-1 text-[11px] uppercase tracking-wider">★</span>}
                {b.label}
                {b.sublabel && <span className="text-brand-textMuted font-normal ml-1 text-xs">· {b.sublabel}</span>}
              </span>
              {showValue ? (
                <span className="text-brand-textActive font-bold tabular-nums">{b.value.toFixed(1)}%</span>
              ) : b.href ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-skyBlue opacity-0 group-hover:opacity-100 transition">View voters →</span>
              ) : null}
            </div>
            <div className="h-4 rounded-full bg-black/10 overflow-hidden border border-brand-border/60">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: b.color, boxShadow: b.highlight ? `0 0 14px ${b.color}99` : undefined }}
              />
            </div>
          </>
        );
        return b.href ? (
          <Link key={b.label} href={b.href} className="group block space-y-1 rounded-md -mx-1 px-1 py-0.5 hover:bg-brand-skyBlue/5 transition">
            {inner}
          </Link>
        ) : (
          <div key={b.label} className="space-y-1">{inner}</div>
        );
      })}
    </div>
  );
}
