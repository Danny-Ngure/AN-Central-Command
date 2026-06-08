// Inline SVG pie + donut. Pure CSS-positioned text overlays — no chart library.
//
// Usage:
//   <Pie data={[{label: 'Men', value: 12, color: '#3b82f6'}, ...]} size={160} />
//   <Donut data={[...]} size={160} centerText="74%" />
//
// Why hand-rolled? Avoids pulling in nivo/chart.js/recharts (~80 KiB) for what is
// arithmetic + path strings. Slices > 0 only; the component sorts large-to-small
// so the legend reads left-to-right by share.

export interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
  showLegend?: boolean;
  centerText?: string;        // donut only
  centerSubText?: string;
  donut?: boolean;
}

export function Pie({ data, size = 160, showLegend = true, donut = false, centerText, centerSubText }: Props) {
  const usable = data.filter((s) => s.value > 0);
  const total = usable.reduce((a, s) => a + s.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xs text-brand-textMuted">No data</span>
      </div>
    );
  }
  const sorted = [...usable].sort((a, b) => b.value - a.value);

  const radius = size / 2;
  const cx = radius;
  const cy = radius;
  const innerR = donut ? radius * 0.62 : 0;

  let acc = 0;
  const paths = sorted.map((s) => {
    const start = (acc / total) * Math.PI * 2;
    acc += s.value;
    const end = (acc / total) * Math.PI * 2;
    const d = arcPath(cx, cy, radius, innerR, start, end);
    return { d, slice: s };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.slice.color} stroke="#0a0a0a" strokeWidth={1} />
          ))}
        </svg>
        {donut && centerText && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-extrabold text-brand-textActive">{centerText}</span>
            {centerSubText && (
              <span className="text-[10px] uppercase tracking-wider text-brand-textMuted">
                {centerSubText}
              </span>
            )}
          </div>
        )}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-xs">
          {sorted.map((s) => {
            const pct = (s.value / total) * 100;
            return (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="text-brand-textActive">{s.label}</span>
                <span className="text-brand-textMuted tabular-nums">
                  {s.value.toLocaleString()} · {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Arc / annular-sector path.
// outerR, innerR; angles in radians from 12 o'clock (subtract PI/2 to align).
function arcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const a0 = startAngle - Math.PI / 2;
  const a1 = endAngle - Math.PI / 2;
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  const xO0 = cx + outerR * Math.cos(a0);
  const yO0 = cy + outerR * Math.sin(a0);
  const xO1 = cx + outerR * Math.cos(a1);
  const yO1 = cy + outerR * Math.sin(a1);

  if (innerR === 0) {
    // Single-arc full pie slice.
    // Handle full circle (one slice = 100%) specially — sweep would degenerate.
    if (endAngle - startAngle >= Math.PI * 2 - 1e-6) {
      return `M ${cx - outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy} Z`;
    }
    return `M ${cx} ${cy} L ${xO0} ${yO0} A ${outerR} ${outerR} 0 ${large} 1 ${xO1} ${yO1} Z`;
  }

  // Donut slice.
  const xI1 = cx + innerR * Math.cos(a1);
  const yI1 = cy + innerR * Math.sin(a1);
  const xI0 = cx + innerR * Math.cos(a0);
  const yI0 = cy + innerR * Math.sin(a0);
  if (endAngle - startAngle >= Math.PI * 2 - 1e-6) {
    return [
      `M ${cx - outerR} ${cy}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy}`,
      `M ${cx - innerR} ${cy}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy}`,
      `Z`,
    ].join(' ');
  }
  return [
    `M ${xO0} ${yO0}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${xO1} ${yO1}`,
    `L ${xI1} ${yI1}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${xI0} ${yI0}`,
    `Z`,
  ].join(' ');
}
