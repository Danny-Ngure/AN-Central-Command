import { VILLAGE_BOUNDARIES } from './village-boundaries';
import { WARD_BOUNDARIES } from './ward-boundaries';

// Constituency-wide village map: every ward's real OSM polygon carved into its
// villages (Voronoi cells, see tools/generate-village-boundaries.cjs), tinted by
// ward. Each village cell links straight to its village page. SVG-only, no token.
// Ward shapes are real; the internal village splits are an approximation.

const WARD_COLORS: Record<string, { fill: string; stroke: string }> = {
  Kadzandani:        { fill: '#d97706', stroke: '#b45309' },
  'Frere Town':      { fill: '#2563eb', stroke: '#1d4ed8' },
  "Ziwa La Ng'ombe": { fill: '#0d9488', stroke: '#0f766e' },
  Kongowea:          { fill: '#16a34a', stroke: '#15803d' },
  Mkomani:           { fill: '#db2777', stroke: '#be185d' },
};
const FALLBACK = { fill: '#64748b', stroke: '#475569' };

function ringCentroid(ring: number[][]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  a *= 0.5;
  if (a === 0) return ring[0] as [number, number];
  return [cx / (6 * a), cy / (6 * a)];
}

export function AllVillagesMap({ className }: { className?: string }) {
  const cells = VILLAGE_BOUNDARIES.features;
  const wardFeats = WARD_BOUNDARIES.features;

  // Frame to all ward polygons.
  const all = wardFeats.flatMap((f) => f.geometry.coordinates[0]);
  const lngs = all.map((p) => p[0]), lats = all.map((p) => p[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const padX = (maxLng - minLng) * 0.02, padY = (maxLat - minLat) * 0.02;
  const x0 = minLng - padX, x1 = maxLng + padX, y0 = minLat - padY, y1 = maxLat + padY;
  const W = 900;
  const H = Math.round(W * ((y1 - y0) / (x1 - x0)));
  const proj = (lng: number, lat: number): [number, number] => [
    ((lng - x0) / (x1 - x0)) * W,
    ((y1 - lat) / (y1 - y0)) * H,
  ];

  // Per-ward village counts for the legend.
  const counts = new Map<string, number>();
  cells.forEach((c) => counts.set(c.properties.wardName, (counts.get(c.properties.wardName) ?? 0) + 1));

  return (
    <div className={`rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden ${className ?? ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block bg-brand-cardBgHeavy/40">
        {/* Village cells (clickable) */}
        {cells.map((f) => {
          const pts = f.geometry.coordinates[0].map(([lng, lat]) => proj(lng, lat));
          const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';
          const c = WARD_COLORS[f.properties.wardName] ?? FALLBACK;
          return (
            <a key={f.properties.villageId} href={`/wards/${f.properties.wardId}/villages/${f.properties.villageId}`} className="group" style={{ cursor: 'pointer' }}>
              <title>{f.properties.name} · {f.properties.wardName}{f.properties.section ? ` · ${f.properties.section}` : ''}</title>
              <path d={d} fill={c.fill} fillOpacity={0.4} stroke="#ffffff" strokeWidth={0.5}
                className="transition-all group-hover:fill-opacity-90" />
            </a>
          );
        })}
        {/* Ward outlines + labels on top */}
        {wardFeats.map((f) => {
          const ring = f.geometry.coordinates[0];
          const pts = ring.map(([lng, lat]) => proj(lng, lat));
          const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';
          const c = WARD_COLORS[f.properties.name] ?? FALLBACK;
          const [clng, clat] = ringCentroid(ring);
          const [cx, cy] = proj(clng, clat);
          return (
            <g key={f.properties.wardId} className="pointer-events-none">
              <path d={d} fill="none" stroke={c.stroke} strokeWidth={2} strokeLinejoin="round" />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={700}
                fill="#1f2937" stroke="#ffffff" strokeWidth={3.5} paintOrder="stroke">
                {f.properties.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend — ward colour + village count (shows ward "size") */}
      <div className="px-4 py-3 border-t border-brand-border flex flex-wrap gap-x-4 gap-y-2">
        {wardFeats.map((f) => {
          const c = WARD_COLORS[f.properties.name] ?? FALLBACK;
          return (
            <span key={f.properties.wardId} className="inline-flex items-center gap-1.5 text-xs text-brand-textBody">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.fill, border: `1px solid ${c.stroke}` }} />
              <span className="font-semibold text-brand-textActive">{f.properties.name}</span>
              <span className="text-brand-textMuted">· {counts.get(f.properties.name) ?? 0} villages</span>
            </span>
          );
        })}
      </div>
      <div className="px-4 py-1.5 border-t border-brand-border/60 text-[10px] text-brand-textMuted">
        Tap any village to open its profile. Ward boundaries © OpenStreetMap contributors; village areas are an approximation.
      </div>
    </div>
  );
}
