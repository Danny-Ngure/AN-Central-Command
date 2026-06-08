// Grouped bar chart — ward-by-ward / cycle comparisons across multiple series.
// Each "group" is a category (ward or year); each group has N adjacent bars.
//
// Sized for visibility: tall bars, large readable labels, theme-correct colours.

export interface GBSeries {
  label: string;      // e.g. "UDA"
  color: string;
  values: number[];   // per-group value (same length as groups[])
}

interface Props {
  groups: string[];
  series: GBSeries[];
  yAxisLabel?: string;
  unit?: string;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

// Theme-correct text colours (this app uses the light theme).
const INK = '#1e293b';      // slate-800 — values + group labels
const MUTED = '#64748b';    // slate-500 — axis ticks
const GRID = '#e2e8f0';     // slate-200 — gridlines
const BASE = '#94a3b8';     // slate-400 — baseline

export function GroupedBarChart({
  groups,
  series,
  yAxisLabel,
  unit = '',
  height = 420,
  showLegend = true,
  className,
}: Props) {
  const padding = { top: 44, right: 24, bottom: 76, left: 72 };
  const groupGap = 56;
  const barWidth = 62;
  const innerBarGap = 12;
  const groupWidth = series.length * barWidth + (series.length - 1) * innerBarGap;
  const chartW = groups.length * (groupWidth + groupGap) + groupGap;
  const chartH = height;
  const totalW = chartW + padding.left + padding.right;
  const totalH = chartH + padding.top + padding.bottom;

  const flat = series.flatMap((s) => s.values);
  const max = niceCeil(Math.max(...flat, 1));

  const yTicks = 5;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (max * i) / yTicks);

  return (
    <div className={`overflow-x-auto ${className ?? 'w-full'} mx-auto`}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full min-w-[600px]">
        {yAxisLabel && (
          <text
            x={18}
            y={padding.top + chartH / 2}
            textAnchor="middle"
            transform={`rotate(-90, 18, ${padding.top + chartH / 2})`}
            fill={MUTED}
            fontSize="15"
            fontWeight="bold"
            letterSpacing="0.15em"
            style={{ textTransform: 'uppercase' }}
          >
            {yAxisLabel}
          </text>
        )}

        {/* Grid + tick labels */}
        {tickValues.map((v, i) => {
          const y = padding.top + chartH - (v / max) * chartH;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke={i === 0 ? BASE : GRID}
                strokeWidth={i === 0 ? 1.5 : 1}
                strokeDasharray={i === 0 ? '0' : '3 5'}
              />
              <text x={padding.left - 12} y={y + 5} textAnchor="end" fill={MUTED} fontSize="16" fontFamily="ui-monospace, monospace">
                {formatTick(v)}
              </text>
            </g>
          );
        })}

        {/* Groups */}
        {groups.map((g, gi) => {
          const gx = padding.left + groupGap / 2 + gi * (groupWidth + groupGap);
          return (
            <g key={g}>
              {series.map((s, si) => {
                const v = s.values[gi] ?? 0;
                const h = (v / max) * chartH;
                const x = gx + si * (barWidth + innerBarGap);
                const y = padding.top + chartH - h;
                return (
                  <g key={si}>
                    <rect x={x} y={y} width={barWidth} height={h} fill={s.color} rx="5" ry="5" />
                    {h > 14 && (
                      <text x={x + barWidth / 2} y={y - 9} textAnchor="middle" fill={INK} fontSize="19" fontWeight="bold" fontFamily="ui-monospace, monospace">
                        {formatTick(v)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={gx + groupWidth / 2} y={padding.top + chartH + 30} textAnchor="middle" fill={INK} fontSize="18" fontWeight="700">
                {abbrev(g, 16)}
              </text>
            </g>
          );
        })}
      </svg>

      {showLegend && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center mt-4 text-sm">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded" style={{ background: s.color }} />
              <span className="text-brand-textActive font-bold">{s.label}</span>
              {unit && <span className="text-brand-textMuted text-xs">({unit})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTick(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

function niceCeil(n: number): number {
  if (n <= 10) return Math.ceil(n);
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / mag;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return niceNorm * mag;
}

function abbrev(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
