'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WARD_BOUNDARIES, type WardPolygonProps } from './ward-boundaries';

// Constituency choropleth (SRS FR-012 + FR-051 coverage variant).
//
// Mapbox GL JS primary path with SVG fallback. Ward polygons coloured by coverage %.
// Click a ward → side panel slides in showing voter count, coverage, top issue, and
// polling-station list. Click "back" closes the panel.
//
// Choropleth metric for this commit: ward coverage %. The 3-mode toggle from SRS
// (Coverage / Influence Density / Persuasion Opportunity — FR-051/052/053) lands in
// a follow-up; this version proves the polygon + selection pattern works.

export interface MapWard {
  id: string;
  name: string;
  lng: number;
  lat: number;
  registeredVoters: number | null;
  coveragePercent: number | null;
  topIssueCategory: string | null;
}

export interface MapPollingStation {
  id: string;
  name: string;
  wardId: string;
  lng: number;
  lat: number;
}

export interface ConstituencyMapProps {
  wards: MapWard[];
  stations: MapPollingStation[];
}

const ISSUE_LABEL: Record<string, string> = {
  water: 'Water supply', sanitation: 'Sanitation', garbage: 'Garbage',
  drainage: 'Drainage / flooding', roads: 'Roads', security: 'Security',
  youth_unemployment: 'Youth unemployment', electricity: 'Electricity',
  healthcare: 'Healthcare', education: 'Education',
};

function coverageColor(pct: number | null | undefined): string {
  if (pct == null) return '#1C1D2A';
  if (pct < 60) return '#FF3E3E';
  if (pct < 75) return '#FF9F1C';
  return '#22C55E';
}

type FeatureWithData = GeoJSON.Feature<
  GeoJSON.Polygon,
  WardPolygonProps & { coverage: number; topIssue: string; registeredVoters: number }
>;

export function ConstituencyMap({ wards, stations }: ConstituencyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);

  // Merge DB ward rows with polygon features so each feature carries the data the
  // choropleth and side panel need. DB values win; polygon fallbacks fill nulls.
  const wardById = useMemo(() => new Map(wards.map((w) => [w.id, w])), [wards]);
  const featuresWithData = useMemo<FeatureWithData[]>(() => {
    return WARD_BOUNDARIES.features.map((f) => {
      const w = wardById.get(f.properties.wardId);
      return {
        ...f,
        properties: {
          ...f.properties,
          coverage: w?.coveragePercent ?? f.properties.fallbackCoverage,
          topIssue: w?.topIssueCategory ?? f.properties.fallbackTopIssue,
          registeredVoters: w?.registeredVoters ?? 0,
        },
      };
    });
  }, [wardById]);

  const stationsByWardId = useMemo(() => {
    const m = new Map<string, MapPollingStation[]>();
    for (const s of stations) {
      const list = m.get(s.wardId) ?? [];
      list.push(s);
      m.set(s.wardId, list);
    }
    return m;
  }, [stations]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof window === 'undefined') return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setUseFallback(true);
      setError('NEXT_PUBLIC_MAPBOX_TOKEN missing');
      return;
    }

    let map: import('mapbox-gl').Map | null = null;
    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        await import('mapbox-gl/dist/mapbox-gl.css');

        if (cancelled || !containerRef.current) return;
        if (!mapboxgl.supported()) {
          setUseFallback(true);
          setError('WebGL not supported');
          return;
        }

        mapboxgl.accessToken = token;

        map = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [39.705, -4.005],
          zoom: 11.5,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

        map.on('error', (e: { error?: { message?: string } }) => {
          if (e.error?.message?.toLowerCase().includes('style')) {
            setUseFallback(true);
            setError(e.error.message ?? 'Style failed');
          }
        });

        map.on('load', () => {
          if (!map || cancelled) return;

          map.addSource('wards', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: featuresWithData },
          });

          map.addLayer({
            id: 'ward-fills',
            type: 'fill',
            source: 'wards',
            paint: {
              'fill-color': [
                'case',
                ['<', ['get', 'coverage'], 60], '#FF3E3E',
                ['<', ['get', 'coverage'], 75], '#FF9F1C',
                '#22C55E',
              ],
              'fill-opacity': 0.5,
            },
          });

          map.addLayer({
            id: 'ward-borders',
            type: 'line',
            source: 'wards',
            paint: {
              'line-color': '#ffffff',
              'line-width': 2,
              'line-opacity': 0.6,
            },
          });

          map.addLayer({
            id: 'ward-labels',
            type: 'symbol',
            source: 'wards',
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 13,
              'text-anchor': 'center',
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': 'rgba(0,0,0,0.8)',
              'text-halo-width': 1.5,
            },
          });

          // Click → select ward
          map.on('click', 'ward-fills', (e) => {
            const wardId = e.features?.[0]?.properties?.wardId as string | undefined;
            if (wardId) setSelectedWardId(wardId);
          });
          map.on('mouseenter', 'ward-fills', () => {
            if (map) map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'ward-fills', () => {
            if (map) map.getCanvas().style.cursor = '';
          });

          // Polling station markers
          for (const s of stations) {
            const el = document.createElement('div');
            el.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#00E5FF;border:1px solid rgba(255,255,255,0.7);cursor:pointer';
            new mapboxgl.Marker({ element: el })
              .setLngLat([s.lng, s.lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(
                  `<div style="color:#0A0B10;font-family:Inter,sans-serif;font-size:12px;font-weight:600">${s.name}</div>`,
                ),
              )
              .addTo(map);
          }
        });
      } catch (err) {
        setUseFallback(true);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [featuresWithData, stations]);

  const selectedFeature = selectedWardId
    ? featuresWithData.find((f) => f.properties.wardId === selectedWardId) ?? null
    : null;
  const selectedStations = selectedWardId ? stationsByWardId.get(selectedWardId) ?? [] : [];

  if (useFallback) {
    return (
      <SvgFallback
        featuresWithData={featuresWithData}
        stations={stations}
        selectedWardId={selectedWardId}
        setSelectedWardId={setSelectedWardId}
        selectedFeature={selectedFeature}
        selectedStations={selectedStations}
        reason={error}
      />
    );
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden relative">
      <div className="px-4 py-2 border-b border-brand-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
          Nyali Constituency
        </h2>
        <span className="text-[10px] text-brand-textMuted">
          Mapbox GL JS · boundaries © IEBC
        </span>
      </div>
      <div ref={containerRef} className="h-[540px] w-full" />
      <Legend />
      {selectedFeature && (
        <SidePanel
          feature={selectedFeature}
          stations={selectedStations}
          onClose={() => setSelectedWardId(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Side panel — slides in from the right when a ward is selected.
// ============================================================================

interface SidePanelProps {
  feature: FeatureWithData;
  stations: MapPollingStation[];
  onClose: () => void;
}

function SidePanel({ feature, stations, onClose }: SidePanelProps) {
  const p = feature.properties;
  const tone = p.coverage >= 75 ? 'good' : p.coverage >= 60 ? 'warn' : 'bad';
  return (
    <div className="absolute top-[40px] right-0 bottom-0 w-[340px] bg-brand-cardBg/95 backdrop-blur-md border-l border-brand-border overflow-y-auto z-10">
      <div className="p-4 border-b border-brand-border">
        <button
          onClick={onClose}
          className="text-brand-textMuted hover:text-brand-textActive text-xs uppercase tracking-wider mb-3 flex items-center gap-1"
        >
          ← Nyali Constituency
        </button>
        <h3 className="text-xl font-bold text-brand-textActive">{p.name}</h3>
        <div className="text-xs text-brand-textMuted mt-1">
          {p.registeredVoters.toLocaleString()} registered voters
        </div>
      </div>

      <div className="p-4 space-y-3 border-b border-brand-border">
        <KpiRow label="Village coverage" value={`${p.coverage}%`} tone={tone} />
        <KpiRow label="Top issue" value={ISSUE_LABEL[p.topIssue] ?? p.topIssue} />
        <KpiRow label="Polling stations" value={String(stations.length)} />
      </div>

      <div className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold mb-2">
          Polling stations
        </div>
        {stations.length === 0 ? (
          <p className="text-xs text-brand-textMuted">No stations visible at your access level.</p>
        ) : (
          <ul className="space-y-1.5">
            {stations.map((s) => (
              <li key={s.id} className="text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan shrink-0" />
                <span className="text-brand-textActive truncate">{s.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiRow({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  const valueClass =
    tone === 'good' ? 'text-emerald-400' :
    tone === 'warn' ? 'text-brand-warning' :
    tone === 'bad' ? 'text-brand-danger' :
    'text-brand-textActive';
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-brand-textMuted">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

// ============================================================================
// Legend
// ============================================================================

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 bg-brand-cardBg/90 backdrop-blur-sm border border-brand-border rounded-lg p-3 text-[10px] space-y-1.5 z-10 pointer-events-none">
      <div className="font-semibold text-brand-textMuted uppercase tracking-wider mb-1">
        Village coverage
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ background: '#FF3E3E' }} />
        <span className="text-brand-textMuted">Below 60%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ background: '#FF9F1C' }} />
        <span className="text-brand-textMuted">60–75%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ background: '#22C55E' }} />
        <span className="text-brand-textMuted">75% or more</span>
      </div>
      <div className="border-t border-brand-border/60 pt-1.5 mt-1.5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
        <span className="text-brand-textMuted">Polling station</span>
      </div>
    </div>
  );
}

// ============================================================================
// SVG fallback — same data, no Mapbox.
// ============================================================================

interface FallbackProps {
  featuresWithData: FeatureWithData[];
  stations: MapPollingStation[];
  selectedWardId: string | null;
  setSelectedWardId: (id: string | null) => void;
  selectedFeature: FeatureWithData | null;
  selectedStations: MapPollingStation[];
  reason: string | null;
}

function SvgFallback({
  featuresWithData,
  stations,
  selectedWardId,
  setSelectedWardId,
  selectedFeature,
  selectedStations,
  reason,
}: FallbackProps) {
  const allLngs = featuresWithData.flatMap((f) => f.geometry.coordinates[0].map(([lng]) => lng)).concat(stations.map((s) => s.lng));
  const allLats = featuresWithData.flatMap((f) => f.geometry.coordinates[0].map(([, lat]) => lat)).concat(stations.map((s) => s.lat));
  const minLng = Math.min(...allLngs) - 0.002;
  const maxLng = Math.max(...allLngs) + 0.002;
  const minLat = Math.min(...allLats) - 0.002;
  const maxLat = Math.max(...allLats) + 0.002;
  const W = 900;
  const H = 540;
  const proj = (lng: number, lat: number): [number, number] => [
    ((lng - minLng) / (maxLng - minLng)) * W,
    ((maxLat - lat) / (maxLat - minLat)) * H,
  ];

  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden relative">
      <div className="px-4 py-2 border-b border-brand-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
          Nyali Constituency
        </h2>
        <span className="text-[10px] text-brand-warning">
          Vector fallback · boundaries © IEBC · {reason ?? 'WebGL unavailable'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[540px]" onClick={() => setSelectedWardId(null)}>
        <defs>
          <pattern id="grid-fb" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(168,85,247,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#08080C" />
        <rect width={W} height={H} fill="url(#grid-fb)" />

        {featuresWithData.map((f) => {
          const points = f.geometry.coordinates[0].map(([lng, lat]) => proj(lng, lat));
          const path = 'M ' + points.map(([x, y]) => `${x},${y}`).join(' L ') + ' Z';
          const centroidLngLat = polygonCentroid(f.geometry.coordinates[0]);
          const [cx, cy] = proj(centroidLngLat[0], centroidLngLat[1]);
          const fill = coverageColor(f.properties.coverage);
          const isSelected = selectedWardId === f.properties.wardId;
          return (
            <g key={f.properties.wardId}>
              <path
                d={path}
                fill={fill}
                fillOpacity={isSelected ? 0.7 : 0.5}
                stroke="#fff"
                strokeOpacity={0.6}
                strokeWidth={isSelected ? 3 : 2}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedWardId(f.properties.wardId);
                }}
              >
                <title>{f.properties.name} — {f.properties.coverage}% coverage</title>
              </path>
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                fill="#fff"
                fontSize="13"
                fontWeight="700"
                style={{ pointerEvents: 'none' }}
                stroke="rgba(0,0,0,0.8)"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {f.properties.name}
              </text>
            </g>
          );
        })}

        {stations.map((s) => {
          const [x, y] = proj(s.lng, s.lat);
          return (
            <circle
              key={s.id}
              cx={x}
              cy={y}
              r="4"
              fill="#00E5FF"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="0.5"
            >
              <title>{s.name}</title>
            </circle>
          );
        })}
      </svg>
      <Legend />
      {selectedFeature && (
        <SidePanel
          feature={selectedFeature}
          stations={selectedStations}
          onClose={() => setSelectedWardId(null)}
        />
      )}
    </div>
  );
}

// Polygon centroid via signed-area formula (simple, non-self-intersecting rings).
function polygonCentroid(ring: number[][]): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  area *= 0.5;
  if (area === 0) return [ring[0][0], ring[0][1]];
  return [cx / (6 * area), cy / (6 * area)];
}
