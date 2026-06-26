import { VILLAGE_BOUNDARIES } from './village-boundaries';
import { WARD_BOUNDARIES } from './ward-boundaries';

// Ward → villages map. Renders the real OSM ward polygon carved into one cell per
// village (Voronoi subdivision, see tools/generate-village-boundaries.cjs), each
// cell tinted by its section and linking to the village page.
//
// SVG-only (no Mapbox token / client JS). Ward shape is real; the internal
// village splits are an approximation seeded by section geography — surfaced in
// the caption so nobody mistakes it for survey boundaries.

const SECTION_COLORS = [
  { fill: '#dbeafe', stroke: '#2563eb', text: '#1d4ed8' },
  { fill: '#dcfce7', stroke: '#16a34a', text: '#15803d' },
  { fill: '#fef3c7', stroke: '#d97706', text: '#b45309' },
  { fill: '#fce7f3', stroke: '#db2777', text: '#be185d' },
  { fill: '#ccfbf1', stroke: '#0d9488', text: '#0f766e' },
  { fill: '#ede9fe', stroke: '#7c3aed', text: '#6d28d9' },
];

function polyCentroid(ring: number[][]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  a *= 0.5;
  if (a === 0) return [ring[0][0], ring[0][1]];
  return [cx / (6 * a), cy / (6 * a)];
}

export function WardVillageMap({ wardId, className }: { wardId: string; className?: string }) {
  const cells = VILLAGE_BOUNDARIES.features.filter((f) => f.properties.wardId === wardId);
  const ward = WARD_BOUNDARIES.features.find((f) => f.properties.wardId === wardId);
  if (cells.length === 0 || !ward) return null;

  // Frame to the ward polygon's extent.
  const ring = ward.geometry.coordinates[0];
  const lngs = ring.map(([lng]) => lng), lats = ring.map(([, lat]) => lat);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const padX = (maxLng - minLng) * 0.04, padY = (maxLat - minLat) * 0.04;
  const x0 = minLng - padX, x1 = maxLng + padX;
  const y0 = minLat - padY, y1 = maxLat + padY;
  const W = 560, H = 460;
  const proj = (lng: number, lat: number): [number, number] => [
    ((lng - x0) / (x1 - x0)) * W,
    ((y1 - lat) / (y1 - y0)) * H,
  ];

  // Stable colour per section.
  const sections = Array.from(new Set(cells.map((c) => c.properties.section ?? 'Unassigned'))).sort();
  const colorOf = (section: string | null) =>
    SECTION_COLORS[sections.indexOf(section ?? 'Unassigned') % SECTION_COLORS.length];

  const wardPts = ring.map(([lng, lat]) => proj(lng, lat));
  const wardPath = 'M ' + wardPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';

  return (
    <div className={`rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden ${className ?? ''}`}>
      <div className="px-3 py-2 border-b border-brand-border flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">
          Village map · {ward.properties.name}
        </span>
        <span className="text-[10px] font-bold text-brand-burnt uppercase tracking-wider">{cells.length} villages</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block bg-brand-cardBgHeavy/40">
        {cells.map((f) => {
          const pts = f.geometry.coordinates[0].map(([lng, lat]) => proj(lng, lat));
          const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';
          const [clng, clat] = polyCentroid(f.geometry.coordinates[0]);
          const [cx, cy] = proj(clng, clat);
          const c = colorOf(f.properties.section);
          return (
            <a key={f.properties.villageId} href={`/wards/${wardId}/villages/${f.properties.villageId}`} className="group" style={{ cursor: 'pointer' }}>
              <title>{f.properties.name}{f.properties.section ? ` — ${f.properties.section}` : ''}</title>
              <path d={d} fill={c.fill} fillOpacity={0.85} stroke={c.stroke} strokeWidth={0.8} strokeLinejoin="round"
                className="transition-all group-hover:fill-opacity-100" />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={600}
                fill={c.text} className="pointer-events-none" style={{ paintOrder: 'stroke' }} stroke="#ffffff" strokeWidth={1.6}>
                {f.properties.name}
              </text>
            </a>
          );
        })}
        {/* Ward outline on top */}
        <path d={wardPath} fill="none" stroke="#8d5a2b" strokeWidth={2} strokeLinejoin="round" />
      </svg>

      {/* Section legend */}
      <div className="px-3 py-2 border-t border-brand-border flex flex-wrap gap-x-3 gap-y-1">
        {sections.map((s) => {
          const c = colorOf(s);
          return (
            <span key={s} className="inline-flex items-center gap-1 text-[10px] text-brand-textBody">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.fill, border: `1px solid ${c.stroke}` }} />
              {s}
            </span>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-brand-border/60 text-[9px] text-brand-textMuted leading-snug">
        Ward boundary: © OpenStreetMap contributors. Village areas are an approximation (Voronoi by section), not survey boundaries.
      </div>
    </div>
  );
}
