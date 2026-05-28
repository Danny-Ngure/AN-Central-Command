/**
 * Fetch real ward boundaries for Nyali Constituency from OpenStreetMap.
 *
 * Replaces the hand-crafted placeholder polygons in
 * apps/web/components/map/ward-boundaries.ts with OSM-sourced GeoJSON.
 *
 * Wards that aren't mapped in OSM (mapping coverage varies in Kenya) keep their
 * hand-crafted polygon as a fallback — the script reports per-ward status so you
 * know which ones are real vs. placeholder.
 *
 * Source: OpenStreetMap via Overpass API.
 * Licence: ODbL — must attribute "© OpenStreetMap contributors" in any UI that
 *          displays the boundaries.
 *
 * Re-run any time. Output is deterministic (sorted output, stable formatting).
 *
 * Usage:
 *   pnpm fetch:boundaries
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import osmtogeojson from 'osmtogeojson';

// Local dataset directory. Any *.json or *.geojson file inside is treated as a
// candidate ward dataset. First file (alphabetical) is used.
// Property keys follow the UN OCHA COD-AB convention: ADM2_EN (constituency) and
// ADM3_EN (ward), with `constituency` / `ward` / `name` as fallback keys.
//
// Recommended dataset: UN OCHA Common Operational Dataset — Kenya
//   https://data.humdata.org/dataset/cod-ab-ken
// Download the adm3 (ward-level) layer; if it ships as Shapefile, convert in-browser
// at https://mapshaper.org and save the GeoJSON output anywhere under tools/data/.
const LOCAL_DATASET_DIR = resolve(process.cwd(), 'tools/data');

function findLocalDataset(): string | null {
  if (!existsSync(LOCAL_DATASET_DIR)) return null;
  const candidates = readdirSync(LOCAL_DATASET_DIR)
    .filter((name) => /\.(geo)?json$/i.test(name))
    .map((name) => {
      const fullPath = resolve(LOCAL_DATASET_DIR, name);
      return { fullPath, mtimeMs: statSync(fullPath).mtimeMs };
    })
    // Newest first so replacing a file picks up the new one without renaming.
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (candidates.length === 0) return null;
  return candidates[0].fullPath;
}

// ----------------------------------------------------------------------------
// Ward registry
// ----------------------------------------------------------------------------

interface WardSpec {
  wardId: string;
  name: string;
  /** Names to try against OSM `name=*`. First successful match wins. */
  osmNames: string[];
  fallbackCoverage: number;
  fallbackTopIssue: string;
  /** Used when OSM has no entry for this ward. Approximate, not surveyor-grade. */
  fallbackPolygon: GeoJSON.Polygon;
}

const WARDS: WardSpec[] = [
  {
    wardId: '22222222-0000-4000-8000-000000000001',
    name: 'Kadzandani',
    osmNames: ['Kadzandani'],
    fallbackCoverage: 65,
    fallbackTopIssue: 'water',
    fallbackPolygon: {
      type: 'Polygon',
      coordinates: [[
        [39.670, -3.965], [39.695, -3.965], [39.700, -3.985],
        [39.695, -4.005], [39.680, -4.015], [39.670, -4.000], [39.670, -3.965],
      ]],
    },
  },
  {
    wardId: '22222222-0000-4000-8000-000000000004',
    name: 'Frere Town',
    osmNames: ['Frere Town', 'Freretown'],
    fallbackCoverage: 58,
    fallbackTopIssue: 'security',
    fallbackPolygon: {
      type: 'Polygon',
      coordinates: [[
        [39.700, -3.965], [39.720, -3.965], [39.725, -3.985],
        [39.720, -3.995], [39.705, -3.990], [39.700, -3.985], [39.700, -3.965],
      ]],
    },
  },
  {
    wardId: '22222222-0000-4000-8000-000000000005',
    name: "Ziwa La Ng'ombe",
    osmNames: ["Ziwa La Ng'ombe", 'Ziwa La Ngombe', 'Ziwa la Ng’ombe'],
    fallbackCoverage: 69,
    fallbackTopIssue: 'youth_unemployment',
    fallbackPolygon: {
      type: 'Polygon',
      coordinates: [[
        [39.720, -3.955], [39.745, -3.955], [39.745, -3.985],
        [39.725, -3.985], [39.720, -3.965], [39.720, -3.955],
      ]],
    },
  },
  {
    wardId: '22222222-0000-4000-8000-000000000002',
    name: 'Kongowea',
    osmNames: ['Kongowea'],
    fallbackCoverage: 82,
    fallbackTopIssue: 'sanitation',
    fallbackPolygon: {
      type: 'Polygon',
      coordinates: [[
        [39.680, -4.015], [39.700, -3.990], [39.720, -3.995],
        [39.725, -4.015], [39.715, -4.035], [39.690, -4.035],
        [39.675, -4.020], [39.680, -4.015],
      ]],
    },
  },
  {
    wardId: '22222222-0000-4000-8000-000000000003',
    name: 'Mkomani',
    osmNames: ['Mkomani'],
    fallbackCoverage: 74,
    fallbackTopIssue: 'drainage',
    fallbackPolygon: {
      type: 'Polygon',
      coordinates: [[
        [39.690, -4.035], [39.715, -4.035], [39.745, -4.025],
        [39.745, -4.080], [39.685, -4.080], [39.675, -4.050], [39.690, -4.035],
      ]],
    },
  },
];

// ----------------------------------------------------------------------------
// Overpass query — administrative relations whose name matches any of our wards.
// ----------------------------------------------------------------------------

// Scoped to Mombasa County bbox (south, west, north, east).
// Names match either as administrative relations OR as any named feature with the
// right name. Kenyan ward boundaries in OSM are inconsistently tagged — some are
// boundary=administrative relations, some are place=suburb nodes/areas, some are
// not in OSM at all.
const OVERPASS_QUERY = `
[out:json][timeout:60][bbox:-4.15,39.5,-3.9,40.0];
(
  relation["name"~"^(Kadzandani|Kongowea|Mkomani|Frere Town|Freretown)$"];
  relation["name"~"^Ziwa.*Ng.?ombe$"];
  way["name"~"^(Kadzandani|Kongowea|Mkomani|Frere Town|Freretown)$"];
  way["name"~"^Ziwa.*Ng.?ombe$"];
);
out body geom;
`.trim();

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

interface ResolvedWard {
  spec: WardSpec;
  geometry: GeoJSON.Polygon;
  source: 'osm' | 'fallback';
  /** Numeric attributes pulled from the source dataset when available. */
  attributes?: {
    registeredVoters?: number;
    valid?: number;
    rejected?: number;
    spoilt?: number;
  };
}

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function fetchFromOverpass(query: string): Promise<{ elements?: unknown[] } | null> {
  const params = new URLSearchParams({ data: query });
  for (const url of OVERPASS_MIRRORS) {
    try {
      console.log(`  → ${new URL(url).host}`);
      const resp = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'an-central-command/0.1 (boundary-fetcher; alfayo-nelson-campaign)',
        },
      });
      if (resp.ok) {
        return (await resp.json()) as { elements?: unknown[] };
      }
      console.log(`    ${resp.status} ${resp.statusText} — trying next mirror`);
    } catch (err) {
      console.log(`    network error — trying next mirror`);
    }
  }
  return null;
}

async function main() {
  // PRIORITY 1: local dataset (e.g., UN OCHA COD-AB Kenya, downloaded manually).
  const localDataset = findLocalDataset();
  if (localDataset) {
    console.log(`Using local dataset at ${localDataset}`);
    const raw = JSON.parse(readFileSync(localDataset, 'utf-8')) as GeoJSON.FeatureCollection;
    console.log(`  Dataset has ${raw.features.length} features`);

    const resolved: ResolvedWard[] = [];
    for (const spec of WARDS) {
      const match = raw.features.find((f) => {
        const props = (f.properties ?? {}) as Record<string, string>;
        const wardName =
          props.ADM3_EN ?? props.ward ?? props.IEBC_WARDS ??
          props.NAME ?? props.name ?? '';
        const constituency =
          props.ADM2_EN ?? props.constituency ??
          props.CONSTITUEN ?? '';
        const matchesWard = spec.osmNames.some((alias) => wardName.toLowerCase() === alias.toLowerCase());
        // If the dataset includes a constituency field, require it to be Nyali.
        if (constituency && constituency.toLowerCase() !== 'nyali') return false;
        return matchesWard;
      });

      if (match && (match.geometry.type === 'Polygon' || match.geometry.type === 'MultiPolygon')) {
        const polygon = match.geometry.type === 'Polygon'
          ? match.geometry
          : largestRingOf(match.geometry);
        const props = (match.properties ?? {}) as Record<string, string | number>;
        const attributes = {
          registeredVoters: parseIntField(props.REGISTERED ?? props.registered ?? props.registered_voters),
          valid: parseIntField(props.VALID ?? props.valid),
          rejected: parseIntField(props.REJECTED ?? props.rejected),
          spoilt: parseIntField(props.SPOILT ?? props.spoilt),
        };
        console.log(`  ✓ ${spec.name}: IEBC polygon (${attributes.registeredVoters?.toLocaleString() ?? '—'} registered voters)`);
        resolved.push({ spec, geometry: polygon, source: 'osm', attributes });
      } else {
        console.log(`  ✗ ${spec.name}: not in local dataset — using hand-crafted fallback`);
        resolved.push({ spec, geometry: spec.fallbackPolygon, source: 'fallback' });
      }
    }

    writeOutput(resolved);
    writeUpdateSql(resolved);
    const realCount = resolved.filter((r) => r.source === 'osm').length;
    console.log(`\nDone. ${realCount} / ${resolved.length} wards from the local dataset.`);
    return;
  }

  // PRIORITY 2: OpenStreetMap via Overpass.
  console.log('No local dataset found under tools/data/ (looking for *.json or *.geojson)');
  console.log('Falling back to OpenStreetMap (mapping coverage of Kenyan wards is incomplete)...');
  const osmData = await fetchFromOverpass(OVERPASS_QUERY);

  if (!osmData) {
    console.error('All Overpass mirrors declined. Falling back to hand-crafted polygons.');
    writeOutput(WARDS.map((spec) => ({ spec, geometry: spec.fallbackPolygon, source: 'fallback' as const })));
    return;
  }

  console.log(`  Got ${osmData.elements?.length ?? 0} OSM elements.`);

  // osmtogeojson types are loose; cast to FeatureCollection for our purposes.
  const geojson = osmtogeojson(osmData) as GeoJSON.FeatureCollection;
  console.log(`  Converted to ${geojson.features.length} GeoJSON features.`);

  const resolved: ResolvedWard[] = [];
  for (const spec of WARDS) {
    const match = geojson.features.find((f) => {
      const fname = String(f.properties?.name ?? '');
      return spec.osmNames.some((alias) => fname.toLowerCase() === alias.toLowerCase());
    });

    if (match && match.geometry.type === 'Polygon') {
      console.log(`  ✓ ${spec.name}: OSM polygon (${match.geometry.coordinates[0].length} vertices)`);
      resolved.push({ spec, geometry: match.geometry, source: 'osm' });
    } else if (match && match.geometry.type === 'MultiPolygon') {
      // Take the largest ring by vertex count — usually the main outer boundary.
      const rings = (match.geometry as GeoJSON.MultiPolygon).coordinates;
      const largest = rings.reduce((biggest, ring) => (ring[0].length > biggest[0].length ? ring : biggest), rings[0]);
      console.log(`  ✓ ${spec.name}: OSM multipolygon → used largest ring (${largest[0].length} vertices)`);
      resolved.push({
        spec,
        geometry: { type: 'Polygon', coordinates: largest },
        source: 'osm',
      });
    } else {
      console.log(`  ✗ ${spec.name}: not in OSM — using hand-crafted fallback`);
      resolved.push({ spec, geometry: spec.fallbackPolygon, source: 'fallback' });
    }
  }

  writeOutput(resolved);

  const osmCount = resolved.filter((r) => r.source === 'osm').length;
  console.log(`\nDone. ${osmCount} / ${resolved.length} wards from OpenStreetMap.`);
  if (osmCount < resolved.length) {
    console.log('Wards without OSM boundaries kept their hand-crafted placeholder.');
    console.log('Consider tracing them manually on overpass-turbo.eu and re-running.');
  }
}

function writeOutput(resolved: ResolvedWard[]): void {
  const features = resolved.map((r) => ({
    type: 'Feature' as const,
    properties: {
      wardId: r.spec.wardId,
      name: r.spec.name,
      fallbackCoverage: r.spec.fallbackCoverage,
      fallbackTopIssue: r.spec.fallbackTopIssue,
      source: r.source,
    },
    geometry: r.geometry,
  }));

  const featureCollection = {
    type: 'FeatureCollection' as const,
    features,
  };

  const out = `// AUTO-GENERATED by tools/fetch-ward-boundaries.ts.
// Source: OpenStreetMap via Overpass API.
// Licence: ODbL — UI displaying these boundaries must attribute
//          "© OpenStreetMap contributors".
// Regenerate via: pnpm fetch:boundaries
//
// Wards marked source="fallback" use hand-crafted approximate polygons because
// OSM has no relation for them (or the relation could not be assembled into a
// closed polygon). Trace these in overpass-turbo.eu when you have time.

export interface WardPolygonProps {
  wardId: string;
  name: string;
  fallbackCoverage: number;
  fallbackTopIssue: string;
  /** 'osm' = OpenStreetMap-sourced; 'fallback' = hand-crafted approximation. */
  source: 'osm' | 'fallback';
}

export const WARD_BOUNDARIES: GeoJSON.FeatureCollection<GeoJSON.Polygon, WardPolygonProps> = ${JSON.stringify(
    featureCollection,
    null,
    2,
  )};
`;

  const outputPath = resolve(process.cwd(), 'apps/web/components/map/ward-boundaries.ts');
  writeFileSync(outputPath, out);
  console.log(`\nWrote ${outputPath}`);
}

function parseIntField(v: string | number | undefined): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Write a SQL UPDATE file with the authoritative IEBC voter / vote counts.
 * Gitignored — the user reviews and applies manually:
 *
 *   docker exec -i alfayo-postgres psql -U alfayo -d alfayo_dev < tools/data/update-wards.sql
 */
function writeUpdateSql(resolved: ResolvedWard[]): void {
  const real = resolved.filter((r) => r.source === 'osm' && r.attributes?.registeredVoters);
  if (real.length === 0) return;

  const lines: string[] = [
    '-- Updates wards with IEBC-published voter / vote counts.',
    '-- Generated by tools/fetch-ward-boundaries.ts. Apply with:',
    '--   docker exec -i alfayo-postgres psql -U alfayo -d alfayo_dev < tools/data/update-wards.sql',
    '-- Review before applying — runs as superuser, bypasses RLS.',
    '',
    'BEGIN;',
  ];

  for (const r of real) {
    const a = r.attributes!;
    lines.push('');
    lines.push(`-- ${r.spec.name} (${r.spec.wardId})`);
    lines.push(`UPDATE wards SET`);
    lines.push(`  registered_voters = ${a.registeredVoters}`);
    lines.push(`WHERE id = '${r.spec.wardId}';`);
  }

  lines.push('');
  lines.push('COMMIT;');

  const outputPath = resolve(process.cwd(), 'tools/data/update-wards.sql');
  writeFileSync(outputPath, lines.join('\n') + '\n');
  console.log(`Wrote ${outputPath}`);
}

/** Take the largest outer ring of a MultiPolygon — usually the main land area. */
function largestRingOf(mp: GeoJSON.MultiPolygon): GeoJSON.Polygon {
  const rings = mp.coordinates;
  const largest = rings.reduce((biggest, ring) => (ring[0].length > biggest[0].length ? ring : biggest), rings[0]);
  return { type: 'Polygon', coordinates: largest };
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
