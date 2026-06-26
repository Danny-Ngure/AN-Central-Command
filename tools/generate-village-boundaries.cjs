// Carve each ward's REAL polygon into one cell per village (a Voronoi subdivision
// clipped to the ward). Output: apps/web/components/map/village-boundaries.ts
//
//   node tools/generate-village-boundaries.cjs
//
// Ward shapes are real (OpenStreetMap, in ward-boundaries.ts). Village positions
// are APPROXIMATE — each village is seeded near its section's anchor inside the
// ward, then a Voronoi tessellation (clipped to the ward polygon via martinez)
// gives every village a sub-area that tiles the ward. Not survey boundaries; a
// planning approximation. Re-run any time village/section data changes.

const fs = require('fs');
const path = require('path');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = postgres(DATABASE_URL, { prepare: false });

// ── Read the real ward polygons out of ward-boundaries.ts ────────────────────
const wbPath = path.join(__dirname, '..', 'apps', 'web', 'components', 'map', 'ward-boundaries.ts');
const wbText = fs.readFileSync(wbPath, 'utf8');
const jsonStart = wbText.indexOf('= {', wbText.indexOf('WARD_BOUNDARIES')) + 2;
const jsonEnd = wbText.lastIndexOf('};') + 1;
const WARD_FC = JSON.parse(wbText.slice(jsonStart, jsonEnd));

// ── Section anchors: where each section sits inside its ward, as [u,v] with ──
//    u = west(0)→east(1), v = south(0)→north(1). Placement is approximate.
const ANCHORS = {
  'Frere Town': {
    'Frere Town core': [0.50, 0.50], 'Bakarani / Barisheba': [0.55, 0.80],
    'Mbungoni / Mgongeni': [0.42, 0.22], 'Bombolulu / Mlaleo': [0.74, 0.52],
  },
  'Kadzandani': {
    'Bamburi': [0.76, 0.80], 'Bombolulu': [0.20, 0.55],
    'Bullo': [0.50, 0.52], 'Kadzandani / Mwatamba': [0.55, 0.22],
  },
  'Kongowea': {
    'Kongowea central': [0.52, 0.52], 'Karama / Kambi Kikuyu': [0.58, 0.80],
    'Ratna / Kadiria': [0.24, 0.44], 'Matopeni / Kangi': [0.52, 0.20],
  },
  'Mkomani': {
    'Nyali estate': [0.62, 0.30], 'Kisumu Ndogo & Maweni': [0.40, 0.66],
  },
  "Ziwa La Ng'ombe": {
    'Ziwa core': [0.45, 0.50], 'Kidogo Basi / Kambi ya Moto': [0.25, 0.45],
    'Shanzu / north': [0.70, 0.72],
  },
};

// ── geometry helpers ─────────────────────────────────────────────────────────
function bbox(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY };
}
function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  a *= 0.5; if (a === 0) return ring[0];
  return [cx / (6 * a), cy / (6 * a)];
}
// Signed area of triangle a-b-p (>0 left of a→b). Used as a signed-distance proxy.
function sideSign(a, b, p) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
// Clip a (possibly concave) subject polygon by a CONVEX clip polygon
// (Sutherland–Hodgman). Correct for concave subjects as long as clip is convex.
function clipSubjectByConvex(subject, convex) {
  let cx = 0, cy = 0;
  for (const p of convex) { cx += p[0]; cy += p[1]; }
  cx /= convex.length; cy /= convex.length;
  let poly = subject.slice();
  for (let i = 0; i < convex.length; i++) {
    const a = convex[i], b = convex[(i + 1) % convex.length];
    const insideSign = Math.sign(sideSign(a, b, [cx, cy])) || 1;
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const cur = poly[k], prv = poly[(k + poly.length - 1) % poly.length];
      const dCur = sideSign(a, b, cur), dPrv = sideSign(a, b, prv);
      const curIn = dCur * insideSign >= 0, prvIn = dPrv * insideSign >= 0;
      if (curIn !== prvIn) {
        const t = dPrv / (dPrv - dCur);
        out.push([prv[0] + t * (cur[0] - prv[0]), prv[1] + t * (cur[1] - prv[1])]);
      }
      if (curIn) out.push(cur);
    }
    poly = out;
    if (poly.length < 3) return [];
  }
  return poly;
}
// Clip a polygon (array of [x,y]) by the half-plane closer to A than to B.
function clipHalfPlane(poly, A, B) {
  const nx = B[0] - A[0], ny = B[1] - A[1];
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
  const c = nx * mx + ny * my;
  const keep = (p) => nx * p[0] + ny * p[1] <= c; // side of A
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], prv = poly[(i + poly.length - 1) % poly.length];
    const curIn = keep(cur), prvIn = keep(prv);
    if (curIn !== prvIn) {
      const d1 = nx * prv[0] + ny * prv[1] - c, d2 = nx * cur[0] + ny * cur[1] - c;
      const t = d1 / (d1 - d2);
      out.push([prv[0] + t * (cur[0] - prv[0]), prv[1] + t * (cur[1] - prv[1])]);
    }
    if (curIn) out.push(cur);
  }
  return out;
}

async function main() {
  const rows = await sql`
    SELECT v.id, v.name, v.section, v.ward_id AS "wardId", w.name AS "wardName"
    FROM villages v JOIN wards w ON w.id = v.ward_id
    WHERE v.deleted_at IS NULL
    ORDER BY w.name, v.section, v.name
  `;

  const features = [];
  let totalCells = 0;

  for (const feat of WARD_FC.features) {
    const wardName = feat.properties.name;
    const wardId = feat.properties.wardId;
    const ring = feat.geometry.coordinates[0];
    const bb = bbox(ring);
    const cen = ringCentroid(ring);
    const anchors = ANCHORS[wardName] ?? {};

    // Unique villages in this ward (dedupe case-variant duplicate rows by name).
    const seen = new Set();
    const villages = rows
      .filter((r) => r.wardId === wardId)
      .filter((r) => { const k = r.name.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

    // Count per section to lay villages out around their anchor.
    const perSection = {};
    villages.forEach((v) => { const s = v.section ?? 'Unassigned'; (perSection[s] ??= []).push(v); });

    // Seed each village: section anchor + golden-angle spread, nudged inside ward.
    const seeds = [];
    for (const [section, vs] of Object.entries(perSection)) {
      const [u, vv] = anchors[section] ?? [0.5, 0.5];
      const ax = bb.minX + u * (bb.maxX - bb.minX);
      const ay = bb.minY + vv * (bb.maxY - bb.minY);
      const spread = 0.10 * Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
      vs.forEach((v, i) => {
        const ang = i * 2.399963; // golden angle
        const rad = vs.length === 1 ? 0 : spread * Math.sqrt(i / vs.length);
        let p = [ax + rad * Math.cos(ang), ay + rad * Math.sin(ang)];
        // pull inside the ward polygon if it landed outside
        for (let k = 0; k < 8 && !pointInRing(p, ring); k++) p = [(p[0] + cen[0]) / 2, (p[1] + cen[1]) / 2];
        if (!pointInRing(p, ring)) p = [cen[0], cen[1]];
        seeds.push({ ...v, section, pt: p });
      });
    }

    // Voronoi cell per seed = bbox clipped by every bisector, then ∩ ward polygon.
    const padX = (bb.maxX - bb.minX) * 0.5, padY = (bb.maxY - bb.minY) * 0.5;
    const box = [
      [bb.minX - padX, bb.minY - padY], [bb.maxX + padX, bb.minY - padY],
      [bb.maxX + padX, bb.maxY + padY], [bb.minX - padX, bb.maxY + padY],
    ];
    for (const seed of seeds) {
      let cell = box;
      for (const other of seeds) {
        if (other === seed) continue;
        cell = clipHalfPlane(cell, seed.pt, other.pt);
        if (cell.length < 3) break;
      }
      if (cell.length < 3) continue;
      // Clip the real (concave) ward polygon by the convex Voronoi cell.
      const wardOpen = ring.slice(0, ring.length - 1);
      const best = clipSubjectByConvex(wardOpen, cell);
      if (!best || best.length < 3) continue;
      const closed = [...best, best[0]];
      const round = closed.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
      features.push({
        type: 'Feature',
        properties: { villageId: seed.id, name: seed.name, section: seed.section, wardId, wardName },
        geometry: { type: 'Polygon', coordinates: [round] },
      });
      totalCells++;
    }
  }

  const header = `// AUTO-GENERATED by tools/generate-village-boundaries.cjs — DO NOT EDIT BY HAND.
// One Voronoi cell per village, clipped to the real OSM ward polygon. Ward shapes
// are real; village sub-areas are an APPROXIMATION seeded by section geography.
// Regenerate: node tools/generate-village-boundaries.cjs

export interface VillagePolygonProps {
  villageId: string;
  name: string;
  section: string | null;
  wardId: string;
  wardName: string;
}

export const VILLAGE_BOUNDARIES: GeoJSON.FeatureCollection<GeoJSON.Polygon, VillagePolygonProps> = `;
  const out = header + JSON.stringify({ type: 'FeatureCollection', features }, null, 1) + ';\n';
  const outPath = path.join(__dirname, '..', 'apps', 'web', 'components', 'map', 'village-boundaries.ts');
  fs.writeFileSync(outPath, out);
  console.log(`✓ Wrote ${totalCells} village cells across ${WARD_FC.features.length} wards → ${path.relative(process.cwd(), outPath)}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
