import Link from 'next/link';

// Ward-coverage donut — pure SVG, no charting dependency.
//
// Shows the AVERAGE ward coverage across the constituency (how we are fairing),
// computed from site-visit ratio per ward. Each ward in the legend is a button
// that opens that ward's own detailed coverage page (/wards/<id>), which has the
// total-outreach donut + per-category coverage and the person in charge.

type WardCoverage = { id: string; name: string; pct: number };

const TONES = ['#16b8a6', '#f0843a', '#38bdf8', '#22d3ee', '#6366f1']; // teal, orange, sky, aqua, indigo

export function CoverageDonut({ average, wards }: { average: number; wards: WardCoverage[] }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, average));
  const filled = (pct / 100) * C;

  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-5">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut → ward coverage summary */}
        <Link href="/wards/coverage" className="relative shrink-0 group" style={{ width: 176, height: 176 }} title="Open Ward Coverage summary">
          <svg viewBox="0 0 140 140" width={176} height={176} className="-rotate-90">
            <circle cx={70} cy={70} r={R} fill="none" stroke="currentColor" strokeWidth={16} className="text-white/10" />
            <circle
              cx={70} cy={70} r={R} fill="none" stroke="url(#covGrad)" strokeWidth={16} strokeLinecap="round"
              strokeDasharray={`${filled} ${C - filled}`}
            />
            <defs>
              <linearGradient id="covGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#16b8a6" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-brand-textActive tabular-nums group-hover:text-brand-tealBright transition">{pct.toFixed(0)}%</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-textMuted text-center leading-tight">
              Avg ward<br />coverage
            </div>
          </div>
        </Link>

        {/* Per-ward legend — each row is a button to its pie chart */}
        <div className="flex-1 w-full space-y-1.5">
          {wards.map((w, i) => (
            <Link
              key={w.id}
              href={`/wards/${w.id}`}
              className="block rounded-lg px-2 py-1 -mx-2 hover:bg-black/5 transition group"
              title={`Open ${w.name} ward coverage`}
            >
              <div className="flex justify-between text-sm text-brand-textMuted">
                <span className="font-semibold text-brand-textBody group-hover:text-brand-burnt transition">{w.name}</span>
                <span className="tabular-nums font-semibold">{w.pct.toFixed(0)}% <span className="text-brand-aqua">›</span></span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-black/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, w.pct)}%`, backgroundColor: TONES[i % TONES.length] }} />
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-3 text-right">
        <Link href="/wards/coverage" className="text-xs font-semibold text-brand-aqua hover:text-brand-skyBlue">Compare all wards →</Link>
      </div>
    </div>
  );
}
