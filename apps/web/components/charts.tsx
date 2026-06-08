// Big, readable comparison charts (SVG + HTML). No charting dependency.
// Sized for visibility — large bars, large pies, legible labels.

export type Datum = { label: string; value: number; color: string };

export const WARD_COLORS = ['#0d9488', '#ea7317', '#2563eb', '#b45309', '#65a30d'];

/* ── Horizontal bar comparison (HTML bars — crisp text, scales well) ── */
export function BarCompare({
  title, subtitle, data, pct = false, unit = '',
}: { title: string; subtitle?: string; data: Datum[]; pct?: boolean; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (v: number) => (pct ? `${v.toFixed(0)}%` : v.toLocaleString()) + unit;
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-cardBg p-6">
      <h3 className="text-base font-bold text-brand-textActive">{title}</h3>
      {subtitle && <p className="text-xs text-brand-textMuted mb-4">{subtitle}</p>}
      <div className="space-y-4 mt-4">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-sm font-semibold text-brand-textBody text-right truncate" title={d.label}>{d.label}</div>
            <div className="flex-1 h-9 rounded-lg bg-black/5 overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center justify-end px-3 min-w-[2.5rem] transition-all"
                style={{ width: `${Math.max(8, (d.value / max) * 100)}%`, backgroundColor: d.color }}
              >
                <span className="text-sm font-black text-white tabular-nums whitespace-nowrap drop-shadow">{fmt(d.value)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Pie / donut comparison (big SVG with % labels + legend) ── */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function PieCompare({
  title, subtitle, data, size = 230, donut = 0,
}: { title: string; subtitle?: string; data: Datum[]; size?: number; donut?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  let angle = 0;
  const slices = data.filter((d) => d.value > 0).map((d) => {
    const frac = d.value / total;
    const start = angle, end = angle + frac * 360;
    angle = end;
    const mid = (start + end) / 2;
    const [lx, ly] = polar(cx, cy, r * 0.62, mid);
    return { ...d, frac, start, end, lx, ly };
  });
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-cardBg p-6">
      <h3 className="text-base font-bold text-brand-textActive">{title}</h3>
      {subtitle && <p className="text-xs text-brand-textMuted mb-2">{subtitle}</p>}
      <div className="flex flex-col sm:flex-row items-center gap-6 mt-3">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="#e2e8f0" />
          ) : slices.map((s, i) => {
            if (s.frac >= 0.9999) return <circle key={i} cx={cx} cy={cy} r={r} fill={s.color} />;
            const [x1, y1] = polar(cx, cy, r, s.start);
            const [x2, y2] = polar(cx, cy, r, s.end);
            const large = s.end - s.start > 180 ? 1 : 0;
            return (
              <g key={i}>
                <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`} fill={s.color} stroke="#fff" strokeWidth="1.5" />
                {s.frac >= 0.06 && (
                  <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.075} fontWeight="800" fill="#fff">
                    {Math.round(s.frac * 100)}%
                  </text>
                )}
              </g>
            );
          })}
          {donut > 0 && <circle cx={cx} cy={cy} r={r * donut} fill="white" />}
        </svg>
        <ul className="space-y-2 text-sm w-full">
          {data.map((d, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-brand-textBody font-medium">{d.label}</span>
              <span className="ml-auto tabular-nums font-bold text-brand-textActive">
                {d.value.toLocaleString()}
                <span className="text-brand-textMuted font-normal"> · {total ? Math.round((d.value / total) * 100) : 0}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
