import { VILLAGE_BOUNDARIES } from './village-boundaries';
import { WARD_BOUNDARIES } from './ward-boundaries';

// Constituency-wide village map: every ward's real OSM polygon carved into its
// villages (Voronoi cells, see tools/generate-village-boundaries.cjs), tinted by
// ward. The five wards share boundary vertices, so their fills abut with no gap
// and read as one joined Nyali constituency. A single bold outer boundary is
// produced by stroking every ward thickly UNDER the fills — internal (shared)
// edges are covered by both neighbours, leaving only the clean outer silhouette.
//
// Village NAMES are drawn on the map with greedy, collision-free placement:
// ward names are anchored first, then village names are placed largest-cell-first
// and any label that would overlap an already-placed one is skipped (it stays
// reachable via hover). This keeps the map readable with zero overlapping text.

const WARD_COLORS: Record<string, { fill: string; stroke: string }> = {
  Kadzandani:        { fill: '#d97706', stroke: '#b45309' },
  'Frere Town':      { fill: '#2563eb', stroke: '#1d4ed8' },
  "Ziwa La Ng'ombe": { fill: '#0d9488', stroke: '#0f766e' },
  Kongowea:          { fill: '#16a34a', stroke: '#15803d' },
  Mkomani:           { fill: '#db2777', stroke: '#be185d' },
};
const FALLBACK = { fill: '#64748b', stroke: '#475569' };

// Bold, unified outer boundary for the whole constituency.
const CONSTITUENCY_STROKE = '#1f2937';

const W = 1040; // SVG width in px — a bit wide to give labels breathing room.

type Box = { x: number; y: number; w: number; h: number };
function overlaps(a: Box, b: Box): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

// Centroid + area of a projected (px) ring, via the shoelace formula.
function centroidAreaPx(pts: [number, number][]): { cx: number; cy: number; area: number } {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  a *= 0.5;
  if (a === 0) { const [x, y] = pts[0]; return { cx: x, cy: y, area: 0 }; }
  return { cx: cx / (6 * a), cy: cy / (6 * a), area: Math.abs(a) };
}

export function AllVillagesMap({ className }: { className?: string }) {
  const cells = VILLAGE_BOUNDARIES.features;
  const wardFeats = WARD_BOUNDARIES.features;

  // Frame to all ward polygons.
  const all = wardFeats.flatMap((f) => f.geometry.coordinates[0]);
  const lngs = all.map((p) => p[0]), lats = all.map((p) => p[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const padX = (maxLng - minLng) * 0.03, padY = (maxLat - minLat) * 0.03;
  const x0 = minLng - padX, x1 = maxLng + padX, y0 = minLat - padY, y1 = maxLat + padY;
  const H = Math.round(W * ((y1 - y0) / (x1 - x0)));
  const proj = (lng: number, lat: number): [number, number] => [
    ((lng - x0) / (x1 - x0)) * W,
    ((y1 - lat) / (y1 - y0)) * H,
  ];

  // Ward paths (projected once) + centroids for the big ward labels.
  const wardPaths = wardFeats.map((f) => {
    const pts = f.geometry.coordinates[0].map(([lng, lat]) => proj(lng, lat));
    const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';
    const { cx, cy } = centroidAreaPx(pts);
    const c = WARD_COLORS[f.properties.name] ?? FALLBACK;
    return { feature: f, d, cx, cy, c };
  });

  // Village cells (projected once) with centroid + area for label placement.
  const villageCells = cells.map((f) => {
    const pts = f.geometry.coordinates[0].map(([lng, lat]) => proj(lng, lat));
    const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';
    const { cx, cy, area } = centroidAreaPx(pts);
    return { feature: f, d, cx, cy, area };
  });

  // ── Greedy, collision-free label placement ────────────────────────────────
  const placed: Box[] = [];
  const PAD = 2; // px breathing room around every label box

  // 1) Ward names anchored first (fixed obstacles village labels must avoid).
  const WARD_FS = 15;
  const wardLabels = wardPaths.map(({ feature, cx, cy }) => {
    const w = feature.properties.name.length * WARD_FS * 0.6;
    placed.push({ x: cx - w / 2 - PAD, y: cy - WARD_FS / 2 - PAD, w: w + PAD * 2, h: WARD_FS + PAD * 2 });
    return { name: feature.properties.name, cx, cy };
  });

  // 2) Village names: largest cell first; skip any that would overlap.
  const VILLAGE_FS = 10.5;
  const MIN_AREA = 240; // px² — don't even try to label slivers
  const shownVillages = [...villageCells]
    .sort((a, b) => b.area - a.area)
    .filter((v) => v.area >= MIN_AREA)
    .flatMap((v) => {
      const w = v.feature.properties.name.length * VILLAGE_FS * 0.55;
      const box: Box = { x: v.cx - w / 2 - PAD, y: v.cy - VILLAGE_FS / 2 - PAD, w: w + PAD * 2, h: VILLAGE_FS + PAD * 2 };
      if (placed.some((p) => overlaps(box, p))) return [];
      placed.push(box);
      return [{ name: v.feature.properties.name, cx: v.cx, cy: v.cy }];
    });

  // Per-ward village counts for the legend.
  const counts = new Map<string, number>();
  cells.forEach((c) => counts.set(c.properties.wardName, (counts.get(c.properties.wardName) ?? 0) + 1));
  const totalVillages = cells.length;

  return (
    <div className={`rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden ${className ?? ''}`}>
      {/* Header — makes clear this is one constituency made of its wards */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-border bg-brand-cardBgHeavy/50">
        <div>
          <div className="text-sm font-bold text-brand-textActive flex items-center gap-1.5">
            🏛️ Nyali Constituency
          </div>
          <div className="text-[11px] text-brand-textMuted">{wardFeats.length} wards joined · {totalVillages} villages · {shownVillages.length} named</div>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-teal">All wards</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block bg-brand-cardBgHeavy/30">
        {/* 1 — bold unified outer boundary (drawn UNDER the fills so only the
               constituency silhouette survives; shared internal edges get covered). */}
        {wardPaths.map(({ feature, d }) => (
          <path key={`b-${feature.properties.wardId}`} d={d} fill="none"
            stroke={CONSTITUENCY_STROKE} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* 2 — solid ward fills. Because wards share vertices, fills abut with no
               gap → the map reads as one joined shape, coloured by ward. */}
        {wardPaths.map(({ feature, d, c }) => (
          <path key={`f-${feature.properties.wardId}`} d={d} fill={c.fill} fillOpacity={0.78}
            stroke="#ffffff" strokeWidth={1.25} strokeLinejoin="round" />
        ))}

        {/* 3 — village cells: visible thin dividers so each village area reads
               clearly; clickable, with a hover highlight. */}
        {villageCells.map(({ feature, d }) => (
          <a key={feature.properties.villageId} href={`/wards/${feature.properties.wardId}/villages/${feature.properties.villageId}`} className="group" style={{ cursor: 'pointer' }}>
            <title>{feature.properties.name} · {feature.properties.wardName}{feature.properties.section ? ` · ${feature.properties.section}` : ''}</title>
            <path d={d} fill="#ffffff" fillOpacity={0} stroke="#ffffff" strokeOpacity={0.4} strokeWidth={0.6}
              className="transition-all group-hover:fill-opacity-35 group-hover:stroke-opacity-90" />
          </a>
        ))}

        {/* 4 — village NAMES (collision-free). Dark text with a white halo so it
               stays legible over any ward colour. */}
        {shownVillages.map((l) => (
          <text key={`v-${l.name}-${l.cx.toFixed(0)}-${l.cy.toFixed(0)}`} x={l.cx} y={l.cy}
            textAnchor="middle" dominantBaseline="middle" fontSize={VILLAGE_FS} fontWeight={600}
            fill="#111827" stroke="#ffffff" strokeWidth={2.4} paintOrder="stroke"
            className="pointer-events-none">
            {l.name}
          </text>
        ))}

        {/* 5 — ward NAMES on top, bolder and larger, as the primary anchors. */}
        {wardLabels.map((l) => (
          <text key={`w-${l.name}`} x={l.cx} y={l.cy} textAnchor="middle" dominantBaseline="middle"
            fontSize={WARD_FS} fontWeight={800} fill="#0b1220" stroke="#ffffff" strokeWidth={4} paintOrder="stroke"
            letterSpacing={0.3} className="pointer-events-none uppercase">
            {l.name}
          </text>
        ))}
      </svg>

      {/* Legend — ward colour + village count (shows ward "size") */}
      <div className="px-4 py-3 border-t border-brand-border flex flex-wrap gap-x-4 gap-y-2">
        {wardPaths.map(({ feature, c }) => (
          <span key={feature.properties.wardId} className="inline-flex items-center gap-1.5 text-xs text-brand-textBody">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.fill, border: `1px solid ${c.stroke}` }} />
            <span className="font-semibold text-brand-textActive">{feature.properties.name}</span>
            <span className="text-brand-textMuted">· {counts.get(feature.properties.name) ?? 0} villages</span>
          </span>
        ))}
      </div>
      <div className="px-4 py-1.5 border-t border-brand-border/60 text-[10px] text-brand-textMuted">
        Village names shown where they fit without overlapping — hover any cell for the rest. Ward boundaries © OpenStreetMap contributors; village areas are an approximation.
      </div>
    </div>
  );
}
