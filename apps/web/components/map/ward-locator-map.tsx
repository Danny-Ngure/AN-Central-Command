import { WARD_BOUNDARIES } from './ward-boundaries';

// Per-ward locator map. Renders the whole Nyali constituency as a small SVG with
// the current ward highlighted in burnt orange and every other ward muted — a
// "you are here" context map for the ward detail page.
//
// SVG-only (no Mapbox token, no client JS) so it always renders and is cheap to
// drop on every ward page. Colours are fixed and read on both light & dark cards.

function centroid(ring: number[][]): [number, number] {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    area += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  area *= 0.5;
  if (area === 0) return [ring[0][0], ring[0][1]];
  return [cx / (6 * area), cy / (6 * area)];
}

// hrefTab controls where clicking a ward goes: undefined → the ward landing;
// 'stations' → that ward's polling stations (so the map "alternates" within the
// polling-stations view), etc.
export function WardLocatorMap({ wardId, className, hrefTab }: { wardId: string; className?: string; hrefTab?: string }) {
  const features = WARD_BOUNDARIES.features;
  const lngs = features.flatMap((f) => f.geometry.coordinates[0].map(([lng]) => lng));
  const lats = features.flatMap((f) => f.geometry.coordinates[0].map(([, lat]) => lat));
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const padX = (maxLng - minLng) * 0.06 || 0.01;
  const padY = (maxLat - minLat) * 0.06 || 0.01;
  const x0 = minLng - padX, x1 = maxLng + padX;
  const y0 = minLat - padY, y1 = maxLat + padY;
  const W = 420, H = 320;
  const proj = (lng: number, lat: number): [number, number] => [
    ((lng - x0) / (x1 - x0)) * W,
    ((y1 - lat) / (y1 - y0)) * H,
  ];

  const current = features.find((f) => f.properties.wardId === wardId);

  return (
    <div className={`rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden ${className ?? ''}`}>
      <div className="px-3 py-2 border-b border-brand-border flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">
          Location in Nyali
        </span>
        {current && <span className="text-[10px] font-bold text-brand-burnt uppercase tracking-wider">{current.properties.name}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block bg-brand-cardBgHeavy/40">
        {/* Render non-selected wards first (muted backdrop), selected on top. */}
        {[...features.filter((f) => f.properties.wardId !== wardId), ...features.filter((f) => f.properties.wardId === wardId)].map((f) => {
          const sel = f.properties.wardId === wardId;
          const pts = f.geometry.coordinates[0].map(([lng, lat]) => proj(lng, lat));
          const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';
          const [clng, clat] = centroid(f.geometry.coordinates[0]);
          const [cx, cy] = proj(clng, clat);
          return (
            // Each ward is a link — click the shape or its name to open that ward.
            <a key={f.properties.wardId} href={`/wards/${f.properties.wardId}${hrefTab ? `?tab=${hrefTab}` : ''}`} className="group" style={{ cursor: 'pointer' }}>
              <title>{sel ? f.properties.name : `Go to ${f.properties.name}`}</title>
              <path
                d={d}
                fill={sel ? '#BE5103' : 'rgba(141,90,43,0.16)'}
                fillOpacity={sel ? 0.9 : 1}
                stroke={sel ? '#BE5103' : 'rgba(141,90,43,0.5)'}
                strokeWidth={sel ? 2.5 : 1}
                strokeLinejoin="round"
                className="transition-opacity group-hover:opacity-70"
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={sel ? 14 : 9}
                fontWeight={sel ? 800 : 600}
                fill={sel ? '#ffffff' : 'rgba(141,90,43,0.95)'}
                stroke={sel ? 'rgba(0,0,0,0.55)' : 'none'}
                strokeWidth={sel ? 3 : 0}
                paintOrder="stroke"
                className="group-hover:underline"
              >
                {f.properties.name}
              </text>
            </a>
          );
        })}
      </svg>
    </div>
  );
}
