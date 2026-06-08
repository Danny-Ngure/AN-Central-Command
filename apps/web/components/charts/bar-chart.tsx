// Inline SVG bar chart — no chart-library dep.
//
// Designed for percentage series (turnout history, coverage trends). For raw counts,
// pass max explicitly so the y-axis scales properly.
//
// Each bar:
//   - rounded top corners
//   - value label hovering above the bar
//   - category label below
//   - colour per bar (call out the "current" or "target" with brand colours)

export interface BarChartBar {
  label: string;
  value: number | null;     // null renders an empty hollow bar with "—"
  color: string;
  hint?: string;            // optional secondary text under the label
}

interface Props {
  bars: BarChartBar[];
  max?: number;             // default 100 (for %s)
  height?: number;          // chart area height in viewBox units
  showGrid?: boolean;
  yAxisLabel?: string;
  className?: string;       // override the wrapper sizing (default: max-w-md)
}

export function BarChart({ bars, max = 100, height = 280, showGrid = true, yAxisLabel, className }: Props) {
  const padding = { top: 36, right: 20, bottom: 52, left: 52 };
  const barWidth = 78;
  const barGap = 28;
  const chartW = bars.length * (barWidth + barGap) + barGap;
  const chartH = height;
  const totalW = chartW + padding.left + padding.right;
  const totalH = chartH + padding.top + padding.bottom;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className={`overflow-x-auto ${className ?? 'max-w-xl'} mx-auto`}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full">
        {/* Y-axis label */}
        {yAxisLabel && (
          <text
            x={12}
            y={padding.top + chartH / 2}
            textAnchor="middle"
            transform={`rotate(-90, 12, ${padding.top + chartH / 2})`}
            fill="#8593a1"
            fontSize="10"
            fontWeight="bold"
            letterSpacing="0.15em"
            style={{ textTransform: 'uppercase' }}
          >
            {yAxisLabel}
          </text>
        )}

        {/* Grid lines */}
        {showGrid && gridLines.map((v) => {
          const y = padding.top + chartH - (v / max) * chartH;
          return (
            <g key={v}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="#1f3640"
                strokeWidth="1"
                strokeDasharray={v === 0 ? '0' : '2 4'}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fill="#8593a1"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
              >
                {v}%
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {bars.map((b, i) => {
          const x = padding.left + barGap / 2 + i * (barWidth + barGap);
          const v = b.value ?? 0;
          const h = b.value == null ? 0 : (Math.max(0, Math.min(max, v)) / max) * chartH;
          const y = padding.top + chartH - h;
          const isEmpty = b.value == null;

          return (
            <g key={i}>
              {isEmpty ? (
                // Hollow bar to indicate "no data yet"
                <rect
                  x={x}
                  y={padding.top + chartH - 6}
                  width={barWidth}
                  height={6}
                  fill="#1f3640"
                  rx="3"
                />
              ) : (
                <>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    fill={b.color}
                    rx="6"
                    ry="6"
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 10}
                    textAnchor="middle"
                    fill="#d4d8de"
                    fontSize="16"
                    fontWeight="bold"
                    fontFamily="ui-monospace, monospace"
                  >
                    {v.toFixed(0)}%
                  </text>
                </>
              )}
              {isEmpty && (
                <text
                  x={x + barWidth / 2}
                  y={padding.top + chartH - 14}
                  textAnchor="middle"
                  fill="#8593a1"
                  fontSize="13"
                  fontWeight="bold"
                >
                  —
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={padding.top + chartH + 22}
                textAnchor="middle"
                fill="#d4d8de"
                fontSize="13"
                fontWeight="600"
              >
                {b.label}
              </text>
              {b.hint && (
                <text
                  x={x + barWidth / 2}
                  y={padding.top + chartH + 40}
                  textAnchor="middle"
                  fill="#8593a1"
                  fontSize="10"
                >
                  {b.hint}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
