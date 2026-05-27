import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useCampaign } from '../context/CampaignContext';
import mapboxgl from 'mapbox-gl';

interface InteractiveMapProps {
  activeHeatmap: 'A' | 'B' | 'C' | null;
  showHexGrid: boolean;
  selectedWard: string | null;
  setSelectedWard: (ward: string | null) => void;
}

interface HexData {
  id: string;
  x: number;
  y: number;
  wardId: string;
  voterDensity: number; // 0 to 100
  margin2022: number; // competitive ratio (-500 to +500)
  lastVisitedDaysAgo: number; // 0 to 365
  warmLeadersCount: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  activeHeatmap,
  showHexGrid,
  selectedWard,
  setSelectedWard
}) => {
  const { language, t, pollingStations } = useCampaign();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [useSvgFallback, setUseSvgFallback] = useState(false);

  // SVG Fallback Interactions State
  const [hoveredHex, setHoveredHex] = useState<HexData | null>(null);
  const [hoveredWard, setHoveredWard] = useState<string | null>(null);
  const [hoveredStation, setHoveredStation] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Map size coordinates for SVG Fallback
  const width = 500;
  const height = 400;

  // 1. Coordinates definitions mapping Mombasa / Nyali Wards (for Mapbox)
  const WARD_GEOJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'kadzandani',
        properties: {
          id: 'kadzandani',
          name: 'Kadzandani',
          nameSw: 'Kadzandani',
          color: '#A855F7', // Purple
          sideColor: '#6B21A8',
          voters: 34200,
          supportPct: 44.5,
          supporters: 185,
          lean: 'leaning_opposition'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [39.685, -4.020],
            [39.718, -4.020],
            [39.718, -3.998],
            [39.685, -3.998],
            [39.685, -4.020]
          ]]
        }
      },
      {
        type: 'Feature',
        id: 'kongowea',
        properties: {
          id: 'kongowea',
          name: 'Kongowea',
          nameSw: 'Kongowea',
          color: '#FF9800', // Orange
          sideColor: '#B45309',
          voters: 45600,
          supportPct: 58.5,
          supporters: 310,
          lean: 'supportive'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [39.680, -4.050],
            [39.698, -4.050],
            [39.698, -4.032],
            [39.680, -4.032],
            [39.680, -4.050]
          ]]
        }
      },
      {
        type: 'Feature',
        id: 'mkomani',
        properties: {
          id: 'mkomani',
          name: 'Mkomani',
          nameSw: 'Mkomani',
          color: '#00B0FF', // Sky Blue
          sideColor: '#0284C7',
          voters: 28900,
          supportPct: 48.2,
          supporters: 142,
          lean: 'neutral'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [39.698, -4.058],
            [39.722, -4.058],
            [39.722, -4.032],
            [39.698, -4.032],
            [39.698, -4.058]
          ]]
        }
      },
      {
        type: 'Feature',
        id: 'frere_town',
        properties: {
          id: 'frere_town',
          name: 'Frere Town',
          nameSw: 'Mji wa Frere',
          color: '#FFFFFF', // White
          sideColor: '#94A3B8',
          voters: 25100,
          supportPct: 52.0,
          supporters: 198,
          lean: 'supportive'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [39.680, -4.032],
            [39.698, -4.032],
            [39.698, -4.020],
            [39.680, -4.020],
            [39.680, -4.032]
          ]]
        }
      },
      {
        type: 'Feature',
        id: 'ziwa_la_ngombe',
        properties: {
          id: 'ziwa_la_ngombe',
          name: 'Ziwa La Ng\'ombe',
          nameSw: 'Ziwa La Ng\'ombe',
          color: '#00E5FF', // Turquoise
          sideColor: '#0891B2',
          voters: 31800,
          supportPct: 49.5,
          supporters: 165,
          lean: 'leaning_supportive'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [39.698, -4.032],
            [39.720, -4.032],
            [39.720, -4.020],
            [39.698, -4.020],
            [39.698, -4.032]
          ]]
        }
      }
    ]
  };

  // Convert polling stations into GeoJSON points for real-world Mapbox coordinates
  const getStationsGeoJson = (): GeoJSON.FeatureCollection => {
    const coordinatesMap: Record<string, [number, number]> = {
      'kadzandani': [39.702, -4.009],
      'kongowea': [39.688, -4.041],
      'mkomani': [39.711, -4.044],
      'frere_town': [39.689, -4.026],
      'ziwa_la_ngombe': [39.709, -4.026]
    };

    return {
      type: 'FeatureCollection',
      features: pollingStations.map(ps => {
        const baseCoords = coordinatesMap[ps.wardId] || [39.704, -4.043];
        const seed = ps.code.charCodeAt(2) || 0;
        const offsetX = ((seed % 10) - 5) * 0.003;
        const offsetY = (((seed * 7) % 10) - 5) * 0.003;

        const margin2022 = (seed * 17) % 900 - 450;
        const lastVisited = (seed * 3.65) % 120;
        const density = 30 + (seed % 70);

        return {
          type: 'Feature',
          properties: {
            id: ps.id,
            name: ps.name,
            code: ps.code,
            wardId: ps.wardId,
            turnout: ps.currentTurnoutCount || 0,
            target: ps.targetTurnout,
            density,
            margin2022,
            lastVisited
          },
          geometry: {
            type: 'Point',
            coordinates: [baseCoords[0] + offsetX, baseCoords[1] + offsetY]
          }
        };
      })
    };
  };

  // SVG Fallback vector path definitions representing Nyali's wards
  const WARD_PATHS = {
    kadzandani: {
      path: "M 50,50 L 250,50 L 220,180 L 150,220 L 50,180 Z",
      labelX: 130,
      labelY: 110,
      nameEn: "Kadzandani",
      nameSw: "Kadzandani",
      lean: "leaning_opposition",
      supportPct: 44.5
    },
    kongowea: {
      path: "M 250,50 L 380,100 L 320,240 L 220,180 Z",
      labelX: 290,
      labelY: 140,
      nameEn: "Kongowea",
      nameSw: "Kongowea",
      lean: "supportive",
      supportPct: 58.5
    },
    mkomani: {
      path: "M 320,240 L 450,220 L 480,350 L 340,350 L 290,290 Z",
      labelX: 375,
      labelY: 300,
      nameEn: "Mkomani",
      nameSw: "Mkomani",
      lean: "neutral",
      supportPct: 48.2
    },
    frere_town: {
      path: "M 380,100 L 480,120 L 450,220 L 320,240 Z",
      labelX: 410,
      labelY: 170,
      nameEn: "Frere Town",
      nameSw: "Mji wa Frere",
      lean: "supportive",
      supportPct: 52.0
    },
    ziwa_la_ngombe: {
      path: "M 50,180 L 150,220 L 290,290 L 340,350 L 120,380 L 50,320 Z",
      labelX: 160,
      labelY: 290,
      nameEn: "Ziwa La Ng'ombe",
      nameSw: "Ziwa La Ng'ombe",
      lean: "leaning_supportive",
      supportPct: 49.5
    }
  };

  // Polygon coordinates list for SVG point-in-polygon math
  const WARD_POLYGONS: Record<string, [number, number][]> = {
    kadzandani: [[50,50], [250,50], [220,180], [150,220], [50,180]],
    kongowea: [[250,50], [380,100], [320,240], [220,180]],
    mkomani: [[320,240], [450,220], [480,350], [340,350], [290,290]],
    frere_town: [[380,100], [480,120], [450,220], [320,240]],
    ziwa_la_ngombe: [[50,180], [150,220], [290,290], [340,350], [120,380], [50,320]]
  };

  // Center centers of wards in SVG coordinates to layout polling stations
  const WARD_SVG_CENTERS: Record<string, { x: number, y: number }> = {
    kadzandani: { x: 130, y: 110 },
    kongowea: { x: 290, y: 140 },
    mkomani: { x: 375, y: 300 },
    frere_town: { x: 410, y: 170 },
    ziwa_la_ngombe: { x: 160, y: 290 }
  };

  // Distribute polling stations inside their ward boundaries using safe bounds
  const getPollingStationSvgCoords = (ps: any) => {
    const center = WARD_SVG_CENTERS[ps.wardId] || { x: 250, y: 200 };
    const seed = ps.code.charCodeAt(2) || 0;
    
    let offsetX = 0;
    let offsetY = 0;
    
    if (ps.wardId === 'kadzandani') {
      offsetX = ((seed % 14) - 7) * 9;
      offsetY = (((seed * 3) % 12) - 6) * 7;
    } else if (ps.wardId === 'kongowea') {
      offsetX = ((seed % 10) - 5) * 8;
      offsetY = (((seed * 3) % 10) - 5) * 8;
    } else if (ps.wardId === 'mkomani') {
      offsetX = ((seed % 10) - 5) * 10;
      offsetY = (((seed * 3) % 8) - 4) * 8;
    } else if (ps.wardId === 'frere_town') {
      offsetX = ((seed % 8) - 4) * 10;
      offsetY = (((seed * 3) % 8) - 4) * 8;
    } else if (ps.wardId === 'ziwa_la_ngombe') {
      offsetX = ((seed % 12) - 6) * 10;
      offsetY = (((seed * 3) % 10) - 5) * 8;
    }
    
    return { x: center.x + offsetX, y: center.y + offsetY };
  };

  // Point in polygon ray-casting math for SVG hex generation
  const isPointInPolygon = (x: number, y: number, polygon: [number, number][]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const findWardForPoint = (x: number, y: number): string | null => {
    for (const [wardId, poly] of Object.entries(WARD_POLYGONS)) {
      if (isPointInPolygon(x, y, poly)) {
        return wardId;
      }
    }
    return null;
  };

  const hexRadius = 10;

  // Generate hex grid memoized
  const hexGrid = useMemo(() => {
    const grid: HexData[] = [];
    const r = hexRadius;
    const w = r * Math.sqrt(3);
    
    let idCounter = 0;
    for (let row = 0; row * 1.5 * r < 400 + r; row++) {
      const y = row * 1.5 * r;
      const offset = (row % 2) * (w / 2);
      for (let col = 0; col * w < 500 + w; col++) {
        const x = col * w + offset;
        
        const wardId = findWardForPoint(x, y);
        if (wardId) {
          const seed = (row * 17 + col * 23) % 100;
          const voterDensity = 30 + (seed % 70);
          const margin2022 = (seed * 11) % 1000 - 500;
          const lastVisitedDaysAgo = (seed * 3.65) % 120;
          const warmLeadersCount = seed % 4;
          
          grid.push({
            id: `hex-${idCounter++}`,
            x,
            y,
            wardId,
            voterDensity,
            margin2022,
            lastVisitedDaysAgo,
            warmLeadersCount
          });
        }
      }
    }
    return grid;
  }, []);

  // SVG Fallback color utilities
  const getWardBaseFill = (id: string, isSelected: boolean, isHovered: boolean) => {
    const colors = {
      kadzandani: '#A855F7',       // Purple
      kongowea: '#FF9800',         // Orange
      mkomani: '#00B0FF',          // Sky Blue
      frere_town: '#FFFFFF',       // White
      ziwa_la_ngombe: '#00E5FF'    // Turquoise
    };

    const baseColor = colors[id as keyof typeof colors] || '#00E5FF';
    
    if (selectedWard && selectedWard !== id) {
      return `${baseColor}25`; // 15% opacity for inactive wards
    }

    if (isHovered) {
      return `${baseColor}E6`; // 90% opacity on hover
    }

    return `${baseColor}73`; // 45% opacity default
  };

  const getWardStrokeColor = (id: string, isSelected: boolean, isHovered: boolean) => {
    if (isSelected) return '#00E5FF'; // Turquoise highlight active border
    if (isHovered) return '#FFFFFF';
    return 'rgba(255, 255, 255, 0.4)';
  };

  const getHexPath = (cx: number, cy: number, r: number) => {
    const w = r * Math.sqrt(3) / 2;
    return `M ${cx},${cy - r} L ${cx + w},${cy - r / 2} L ${cx + w},${cy + r / 2} L ${cx},${cy + r} L ${cx - w},${cy + r / 2} L ${cx - w},${cy - r / 2} Z`;
  };

  const getHexStyle = (hex: HexData) => {
    if (!activeHeatmap) {
      return {
        fill: 'transparent',
        stroke: 'rgba(35, 37, 53, 0.25)',
        strokeWidth: 0.5
      };
    }

    if (activeHeatmap === 'A') {
      const recencyWeight = Math.max(0, 1 - hex.lastVisitedDaysAgo / 90);
      return {
        fill: `rgba(0, 229, 255, ${Math.max(0.1, recencyWeight * 0.85)})`,
        stroke: 'rgba(10, 11, 16, 0.4)',
        strokeWidth: 0.5
      };
    }

    if (activeHeatmap === 'B') {
      const score = Math.min(1, hex.warmLeadersCount / 3);
      return {
        fill: `rgba(122, 92, 255, ${Math.max(0.08, score * 0.95)})`,
        stroke: 'rgba(10, 11, 16, 0.4)',
        strokeWidth: 0.5
      };
    }

    const marginScore = Math.max(0, 1 - Math.abs(hex.margin2022) / 600);
    const coverageScore = Math.min(1, hex.lastVisitedDaysAgo / 90);
    const densityScore = hex.voterDensity / 100;
    const blendedOpportunity = (marginScore * 0.4) + (densityScore * 0.3) + (coverageScore * 0.3);
    
    return {
      fill: `rgba(255, 152, 0, ${Math.max(0.1, blendedOpportunity * 0.95)})`, // Orange Opportunity blending
      stroke: 'rgba(10, 11, 16, 0.4)',
      strokeWidth: 0.5
    };
  };

  const handleMouseMoveHex = (e: React.MouseEvent, hex: HexData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mapContainer = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (mapContainer) {
      setTooltipPos({
        x: rect.left - mapContainer.left + 20,
        y: rect.top - mapContainer.top - 170
      });
    }
    setHoveredHex(hex);
  };

  const handleMouseMoveWard = (e: React.MouseEvent, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mapContainer = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (mapContainer && !showHexGrid) {
      setTooltipPos({
        x: rect.left - mapContainer.left + (rect.width / 2) - 90,
        y: rect.top - mapContainer.top + (rect.height / 2) - 100
      });
      setHoveredWard(id);
    }
  };

  const handleMouseMoveStation = (e: React.MouseEvent, ps: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mapContainer = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (mapContainer) {
      setTooltipPos({
        x: rect.left - mapContainer.left + 15,
        y: rect.top - mapContainer.top - 145
      });
    }
    setHoveredStation(ps);
  };

  // 2. Initialize Mapbox GL JS with Try/Catch and Fallback listeners
  useEffect(() => {
    if (useSvgFallback) return;
    if (!mapContainerRef.current) return;

    if (!mapboxgl.supported()) {
      console.warn("Mapbox GL JS WebGL not supported, using SVG fallback");
      setUseSvgFallback(true);
      return;
    }

    let mapInstance: mapboxgl.Map | null = null;
    let loadTimeout: number | null = null;

    try {
      mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTAwY2kyb3BlbXk3OG9hN2sifQ.yJ50H2gH0gW9q6Q1Jp73wA';

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [39.702, -4.032],
        zoom: 12.0,
        pitch: 40,
        bearing: -10,
        attributionControl: false
      });
      mapInstance = map;
      mapRef.current = map;

      // Add navigation controls
      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

      // Error handler fallback
      map.on('error', (e) => {
        console.warn("Mapbox rendering error, switching to vector SVG fallback:", e);
        setUseSvgFallback(true);
      });

      // Timeout fallback in case map tiles or assets fail to fetch/render
      loadTimeout = window.setTimeout(() => {
        if (!mapLoaded && !useSvgFallback) {
          console.warn("Mapbox failed to load within timeout, falling back to SVG");
          setUseSvgFallback(true);
        }
      }, 4000);

      map.on('load', () => {
        if (loadTimeout !== null) {
          window.clearTimeout(loadTimeout);
          loadTimeout = null;
        }

        // Sources & Layers Setup
        map.addSource('nyali-wards', {
          type: 'geojson',
          data: WARD_GEOJSON
        });

        map.addSource('polling-stations', {
          type: 'geojson',
          data: getStationsGeoJson()
        });

        map.addLayer({
          id: 'wards-fill',
          type: 'fill',
          source: 'nyali-wards',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.45
          }
        });

        map.addLayer({
          id: 'wards-outline',
          type: 'line',
          source: 'nyali-wards',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 1.5,
            'line-opacity': 0.7
          }
        });

        map.addLayer({
          id: 'wards-labels',
          type: 'symbol',
          source: 'nyali-wards',
          layout: {
            'text-field': language === 'en' ? ['get', 'name'] : ['get', 'nameSw'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.1,
            'text-offset': [0, -0.5]
          },
          paint: {
            'text-color': '#00E5FF',
            'text-halo-color': '#000000',
            'text-halo-width': 2
          }
        });

        map.addLayer({
          id: 'stations-points',
          type: 'circle',
          source: 'polling-stations',
          paint: {
            'circle-radius': 6,
            'circle-color': '#FF9800',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#FFFFFF',
            'circle-opacity': 0
          }
        });

        map.addLayer({
          id: 'heatmap-layer',
          type: 'heatmap',
          source: 'polling-stations',
          maxzoom: 16,
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'density'], 0, 0, 100, 1],
            'heatmap-intensity': 0.8,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.2, 'rgba(168, 85, 247, 0.2)',
              0.4, 'rgba(0, 176, 255, 0.5)',
              0.6, 'rgba(0, 229, 255, 0.8)',
              0.8, 'rgba(255, 152, 0, 0.9)',
              1.0, 'rgba(255, 255, 255, 1.0)'
            ],
            'heatmap-radius': 30,
            'heatmap-opacity': 0
          }
        });

        setMapLoaded(true);

        // Click interaction
        map.on('click', 'wards-fill', (e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const clickedWardId = feature.properties?.id;
            setSelectedWard(selectedWard === clickedWardId ? null : clickedWardId);
          }
        });

        // Hover popup tooltip
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'mapbox-custom-popup z-50'
        });

        map.on('mousemove', 'wards-fill', (e) => {
          if (e.features && e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
            const f = e.features[0];
            const props = f.properties;
            
            if (props) {
              const html = `
                <div class="bg-[#0C0D14] border border-[#23274D] p-3 rounded-xl text-xs space-y-1.5 text-white shadow-2xl min-w-[180px]">
                  <div class="border-b border-[#23274D] pb-1 font-black text-[#00E5FF] uppercase tracking-wider flex items-center justify-between">
                    <span>${language === 'en' ? props.name : props.nameSw}</span>
                    <span class="text-[8px] bg-brand-violet/20 text-[#A855F7] px-2 py-0.5 rounded font-black border border-brand-violet/30">${props.lean.replace('_', ' ')}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-brand-textMuted">Registered:</span>
                    <span class="font-bold text-white">${Number(props.voters).toLocaleString()}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-brand-textMuted">Support:</span>
                    <span class="font-bold text-[#00E5FF]">${props.supportPct}%</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-brand-textMuted">Committed:</span>
                    <span class="font-bold text-white">${props.supporters}</span>
                  </div>
                </div>
              `;
              popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
            }
          }
        });

        map.on('mouseleave', 'wards-fill', () => {
          map.getCanvas().style.cursor = '';
          popup.remove();
        });
      });
    } catch (e) {
      console.warn("Exception during Mapbox load, falling back to SVG:", e);
      setUseSvgFallback(true);
    }

    return () => {
      if (loadTimeout !== null) {
        window.clearTimeout(loadTimeout);
      }
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [useSvgFallback, mapLoaded]);

  // Update styling filters on selectedWard change (Mapbox)
  useEffect(() => {
    if (useSvgFallback || !mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    try {
      if (selectedWard) {
        map.setPaintProperty('wards-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'id'], selectedWard],
          0.75,
          0.12
        ]);
        map.setPaintProperty('wards-outline', 'line-color', [
          'case',
          ['==', ['get', 'id'], selectedWard],
          '#00E5FF',
          'rgba(255, 255, 255, 0.2)'
        ]);
      } else {
        map.setPaintProperty('wards-fill', 'fill-opacity', 0.45);
        map.setPaintProperty('wards-outline', 'line-color', '#FFFFFF');
      }
    } catch (e) {
      console.warn("Mapbox style not ready for state change", e);
    }
  }, [selectedWard, mapLoaded, useSvgFallback]);

  // Update dynamic visibility when showHexGrid changes (Mapbox)
  useEffect(() => {
    if (useSvgFallback || !mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    try {
      map.setPaintProperty('stations-points', 'circle-opacity', showHexGrid ? 0.9 : 0);
      map.setPaintProperty('stations-points', 'circle-stroke-opacity', showHexGrid ? 0.9 : 0);
    } catch (e) {
      console.warn("Mapbox style not ready for hex grid change", e);
    }
  }, [showHexGrid, mapLoaded, useSvgFallback]);

  // Update Heatmap layers config (Mapbox)
  useEffect(() => {
    if (useSvgFallback || !mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    try {
      if (activeHeatmap) {
        map.setPaintProperty('heatmap-layer', 'heatmap-opacity', 0.85);

        if (activeHeatmap === 'A') {
          map.setPaintProperty('heatmap-layer', 'heatmap-weight', [
            'interpolate', ['linear'], ['get', 'lastVisited'], 0, 1, 120, 0.05
          ]);
        } else if (activeHeatmap === 'B') {
          map.setPaintProperty('heatmap-layer', 'heatmap-weight', [
            'interpolate', ['linear'], ['get', 'density'], 0, 0, 100, 1
          ]);
        } else {
          map.setPaintProperty('heatmap-layer', 'heatmap-weight', [
            'interpolate', ['linear'], ['get', 'margin2022'], -450, 1, 450, 0.1
          ]);
        }
      } else {
        map.setPaintProperty('heatmap-layer', 'heatmap-opacity', 0);
      }
    } catch (e) {
      console.warn("Mapbox style not ready for heatmap change", e);
    }
  }, [activeHeatmap, mapLoaded, useSvgFallback]);

  return (
    <div className="relative border border-brand-border bg-[#0C0D14] rounded-xl p-5 select-none shadow-2xl flex flex-col items-center w-full min-h-[490px]">
      
      {/* Map Header Control */}
      <div className="w-full flex justify-between items-center mb-4">
        <div className="space-y-0.5">
          <span className="text-[10px] text-[#00E5FF] font-bold uppercase tracking-wider block">
            NYALI CONSTITUENCY MAP {useSvgFallback ? '(VECTOR FALLBACK)' : '(MAPBOX GL JS)'}
          </span>
          <h3 className="text-sm font-extrabold text-brand-textActive uppercase tracking-wide">
            {activeHeatmap ? t(`dashboard.heatmap${activeHeatmap}`) : 'Interactive Ward Results Board'}
          </h3>
        </div>
        <div className="flex gap-2 text-[10px] text-brand-textMuted font-bold">
          <span>Click Ward to Drill Down</span>
        </div>
      </div>

      {/* Map Content Area */}
      {useSvgFallback ? (
        // Interactive SVG fallback component
        <div className="relative w-full max-w-[500px] bg-[#090A0F] rounded-lg border border-brand-border/40 p-2 overflow-hidden flex items-center justify-center">
          <svg 
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full h-auto"
            style={{ filter: 'drop-shadow(0px 20px 12px rgba(0, 0, 0, 0.85))' }}
          >
            {/* 3D Extrusion Side Depth Layer */}
            {Object.entries(WARD_PATHS).map(([id, ward]) => {
              const isSelected = selectedWard === id;
              let sideColor = isSelected ? '#0066FF' : '#25211D';
              
              if (selectedWard && !isSelected) {
                sideColor = 'rgba(37, 33, 29, 0.15)';
              }
              
              return (
                <path
                  key={`${id}-depth`}
                  d={ward.path}
                  transform="translate(4, 7)"
                  fill={sideColor}
                  stroke="#13110E"
                  strokeWidth="0.8"
                  opacity="0.95"
                  className="transition-all duration-300"
                />
              );
            })}

            {/* Actual Wards Paths on Top */}
            {Object.entries(WARD_PATHS).map(([id, ward]) => {
              const isSelected = selectedWard === id;
              const isHovered = hoveredWard === id;
              const fill = getWardBaseFill(id, isSelected, isHovered);
              const stroke = getWardStrokeColor(id, isSelected, isHovered);
              
              return (
                <g key={id}>
                  <path
                    d={ward.path}
                    onClick={() => setSelectedWard(selectedWard === id ? null : id)}
                    onMouseMove={(e) => handleMouseMoveWard(e, id)}
                    onMouseEnter={(e) => handleMouseMoveWard(e, id)}
                    onMouseLeave={() => setHoveredWard(null)}
                    className="cursor-pointer transition-all duration-300"
                    style={{
                      fill,
                      stroke,
                      strokeWidth: isSelected ? 2.5 : isHovered ? 1.8 : 1,
                      filter: isSelected ? 'drop-shadow(0 0 8px rgba(0, 229, 255, 0.5))' : 'none'
                    }}
                  />
                  
                  {/* Glowing Neon Name Label */}
                  <g className="pointer-events-none">
                    <text
                      x={ward.labelX}
                      y={ward.labelY}
                      textAnchor="middle"
                      className="text-[11px] font-black uppercase tracking-wider font-sans select-none"
                      style={{
                        fill: '#FFFFFF',
                        textShadow: isSelected ? '0 0 5px #00E5FF, 0 0 10px #00B0FF' : '0 0 4px #000000'
                      }}
                    >
                      {language === 'en' ? ward.nameEn : ward.nameSw}
                    </text>
                    
                    {/* Support percentage float */}
                    <text
                      x={ward.labelX}
                      y={ward.labelY + 11}
                      textAnchor="middle"
                      className="text-[9px] font-extrabold font-mono select-none"
                      style={{
                        fill: '#00E5FF',
                        textShadow: '0 0 4px rgba(0, 0, 0, 0.9)'
                      }}
                    >
                      {ward.supportPct}%
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Major Transit Highways */}
            <g opacity="0.22" className="pointer-events-none select-none">
              {/* Nyali Road */}
              <path 
                d="M 80,360 C 130,290 220,230 350,150 L 440,90" 
                fill="none" 
                stroke="#00E5FF" 
                strokeWidth="2" 
                strokeDasharray="4,4" 
              />
              <text x="140" y="275" transform="rotate(-35, 140, 275)" fill="#00E5FF" fontSize="7" fontWeight="bold" letterSpacing="0.1em">
                NYALI RD
              </text>

              {/* Links Road */}
              <path 
                d="M 270,205 C 250,150 200,110 150,55" 
                fill="none" 
                stroke="#00E5FF" 
                strokeWidth="1.5" 
                strokeDasharray="3,3" 
              />
              <text x="210" y="125" transform="rotate(-50, 210, 125)" fill="#00E5FF" fontSize="7" fontWeight="bold" letterSpacing="0.1em">
                LINKS RD
              </text>

              {/* Fidel Odinga Road */}
              <path 
                d="M 175,270 L 260,280 L 360,295" 
                fill="none" 
                stroke="#00E5FF" 
                strokeWidth="1.5" 
                strokeDasharray="3,3" 
              />
              <text x="250" y="291" fill="#00E5FF" fontSize="7" fontWeight="bold" letterSpacing="0.1em">
                FIDEL ODINGA RD
              </text>
            </g>

            {/* Local Landmark Labels */}
            <g opacity="0.45" className="pointer-events-none select-none text-[8px] font-semibold tracking-wide fill-white font-sans">
              <circle cx="70" cy="370" r="2.5" fill="#00E5FF" />
              <text x="78" y="373">Nyali Bridge</text>

              <circle cx="250" cy="225" r="2.5" fill="#00E5FF" />
              <text x="257" y="228">Kongowea Market</text>

              <circle cx="340" cy="210" r="2.5" fill="#00E5FF" />
              <text x="347" y="213">Nyali Golf Club</text>

              <circle cx="190" cy="170" r="2.5" fill="#00E5FF" />
              <text x="197" y="173">Mamba Village</text>
            </g>

            {/* Hex-Grid Overlay Layer */}
            {showHexGrid && !activeHeatmap && (
              <g className="transition-opacity duration-300">
                {hexGrid
                  .filter(hex => !selectedWard || hex.wardId === selectedWard)
                  .map(hex => {
                    const style = getHexStyle(hex);
                    const isHovered = hoveredHex?.id === hex.id;
                    
                    return (
                      <path
                        key={hex.id}
                        d={getHexPath(hex.x, hex.y, hexRadius)}
                        onMouseMove={(e) => handleMouseMoveHex(e, hex)}
                        onMouseEnter={(e) => handleMouseMoveHex(e, hex)}
                        onMouseLeave={() => setHoveredHex(null)}
                        onClick={() => setSelectedWard(selectedWard === hex.wardId ? null : hex.wardId)}
                        className={`cursor-crosshair transition-colors duration-150`}
                        style={{
                          ...style,
                          stroke: isHovered ? '#FFFFFF' : style.stroke,
                          strokeWidth: isHovered ? 1.5 : style.strokeWidth
                        }}
                      />
                    );
                  })}
              </g>
            )}

            {/* Active Heatmap Hex Grid Layer */}
            {activeHeatmap && (
              <g className="transition-opacity duration-300">
                {hexGrid
                  .filter(hex => !selectedWard || hex.wardId === selectedWard)
                  .map(hex => {
                    const style = getHexStyle(hex);
                    const isHovered = hoveredHex?.id === hex.id;
                    
                    return (
                      <path
                        key={hex.id}
                        d={getHexPath(hex.x, hex.y, hexRadius)}
                        onMouseMove={(e) => handleMouseMoveHex(e, hex)}
                        onMouseEnter={(e) => handleMouseMoveHex(e, hex)}
                        onMouseLeave={() => setHoveredHex(null)}
                        onClick={() => setSelectedWard(selectedWard === hex.wardId ? null : hex.wardId)}
                        className={`cursor-crosshair transition-colors duration-150`}
                        style={{
                          ...style,
                          stroke: isHovered ? '#FFFFFF' : style.stroke,
                          strokeWidth: isHovered ? 1.5 : style.strokeWidth
                        }}
                      />
                    );
                  })}
              </g>
            )}

            {/* Polling Station Overlay */}
            {showHexGrid && (
              <g className="transition-opacity duration-300">
                {pollingStations
                  .filter(ps => !selectedWard || ps.wardId === selectedWard)
                  .map(ps => {
                    const coords = getPollingStationSvgCoords(ps);
                    const isHovered = hoveredStation?.id === ps.id;
                    
                    return (
                      <circle
                        key={ps.id}
                        cx={coords.x}
                        cy={coords.y}
                        r={isHovered ? 7.5 : 5.5}
                        fill="#FF9800"
                        stroke="#FFFFFF"
                        strokeWidth={isHovered ? 2 : 1.2}
                        onMouseMove={(e) => handleMouseMoveStation(e, ps)}
                        onMouseEnter={(e) => handleMouseMoveStation(e, ps)}
                        onMouseLeave={() => setHoveredStation(null)}
                        onClick={() => setSelectedWard(selectedWard === ps.wardId ? null : ps.wardId)}
                        className="cursor-pointer transition-all duration-150"
                        style={{
                          filter: isHovered ? 'drop-shadow(0 0 6px #FF9800)' : 'none'
                        }}
                      />
                    );
                  })}
              </g>
            )}

            {/* Cartographic HUD (Scale & Compass) */}
            <g className="pointer-events-none select-none" transform="translate(420, 340)">
              {/* Compass North Arrow */}
              <line x1="0" y1="0" x2="0" y2="-20" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="1" />
              <polygon points="0,-20 -4,-12 4,-12" fill="#00E5FF" />
              <text x="-4" y="10" fill="#FFFFFF" fontSize="8" fontWeight="bold" fontFamily="sans-serif">N</text>

              {/* Graphical Scale Bar (1 km) */}
              <g transform="translate(-40, 25)">
                <line x1="0" y1="0" x2="50" y2="0" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="1" />
                <line x1="0" y1="-3" x2="0" y2="3" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="1" />
                <line x1="25" y1="-2" x2="25" y2="2" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1" />
                <line x1="50" y1="-3" x2="50" y2="3" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="1" />
                <text x="18" y="-5" fill="rgba(255, 255, 255, 0.5)" fontSize="6" fontFamily="monospace">500m</text>
                <text x="45" y="-5" fill="#FFFFFF" fontSize="6" fontWeight="bold" fontFamily="monospace">1km</text>
              </g>
            </g>
          </svg>

          {/* SVG Hover Tooltips */}
          {hoveredHex && (
            <div 
              className="absolute z-50 pointer-events-none bg-[#0C0D14] border border-[#23274D] p-3 rounded-xl text-xs space-y-1.5 text-white shadow-2xl min-w-[180px]"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              <div className="border-b border-[#23274D] pb-1 font-black text-[#00E5FF] uppercase tracking-wider flex items-center justify-between">
                <span>{hoveredHex.wardId.toUpperCase().replace('_', ' ')} cell</span>
                <span className="text-[8px] bg-brand-border/40 text-brand-textMuted px-1.5 py-0.5 rounded font-black border border-brand-border/20">
                  {hoveredHex.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Voter Density:</span>
                <span className="font-bold text-white">{hoveredHex.voterDensity}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">2022 Margin:</span>
                <span className={`font-bold ${hoveredHex.margin2022 >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {hoveredHex.margin2022 >= 0 ? `+${hoveredHex.margin2022}` : hoveredHex.margin2022}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Last Visited:</span>
                <span className="font-bold text-white">{Math.round(hexGrid.find(h => h.id === hoveredHex.id)?.lastVisitedDaysAgo || 0)}d ago</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Warm Leaders:</span>
                <span className="font-bold text-white">{hoveredHex.warmLeadersCount}</span>
              </div>
            </div>
          )}

          {hoveredStation && (
            <div 
              className="absolute z-50 pointer-events-none bg-[#0C0D14] border border-[#23274D] p-3 rounded-xl text-xs space-y-1.5 text-white shadow-2xl min-w-[200px]"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              <div className="border-b border-[#23274D] pb-1 font-black text-[#FF9800] uppercase tracking-wider flex items-center justify-between">
                <span className="truncate max-w-[130px]">{hoveredStation.name}</span>
                <span className="text-[8px] bg-brand-border/40 text-brand-textMuted px-1.5 py-0.5 rounded font-black border border-brand-border/20">
                  {hoveredStation.code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Ward:</span>
                <span className="font-bold text-white uppercase">{hoveredStation.wardId.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Turnout Count:</span>
                <span className="font-bold text-[#FF9800]">{hoveredStation.currentTurnoutCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Target Turnout:</span>
                <span className="font-bold text-white">{hoveredStation.targetTurnout}</span>
              </div>
              
              {/* Turnout Progress Bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[9px] text-brand-textMuted">
                  <span>Progress:</span>
                  <span>{Math.round(((hoveredStation.currentTurnoutCount || 0) / (hoveredStation.targetTurnout || 1)) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#12131C] rounded-full overflow-hidden border border-brand-border/30">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-[#FF9800] transition-all duration-300"
                    style={{ width: `${Math.min(100, ((hoveredStation.currentTurnoutCount || 0) / (hoveredStation.targetTurnout || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {!showHexGrid && hoveredWard && (
            <div 
              className="absolute z-50 pointer-events-none bg-[#0C0D14] border border-[#23274D] p-3 rounded-xl text-xs space-y-1.5 text-white shadow-2xl min-w-[180px]"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              {(() => {
                const ward = WARD_PATHS[hoveredWard as keyof typeof WARD_PATHS];
                if (!ward) return null;
                
                const geojsonProperties: Record<string, { voters: number, supporters: number, lean: string }> = {
                  kadzandani: { voters: 34200, supporters: 185, lean: 'leaning_opposition' },
                  kongowea: { voters: 45600, supporters: 310, lean: 'supportive' },
                  mkomani: { voters: 28900, supporters: 142, lean: 'neutral' },
                  frere_town: { voters: 25100, supporters: 198, lean: 'supportive' },
                  ziwa_la_ngombe: { voters: 31800, supporters: 165, lean: 'leaning_supportive' }
                };
                const props = geojsonProperties[hoveredWard] || { voters: 0, supporters: 0, lean: 'neutral' };
                
                return (
                  <>
                    <div className="border-b border-[#23274D] pb-1 font-black text-[#00E5FF] uppercase tracking-wider flex items-center justify-between">
                      <span>{language === 'en' ? ward.nameEn : ward.nameSw}</span>
                      <span className="text-[8px] bg-[#A855F7]/20 text-[#A855F7] px-2 py-0.5 rounded font-black border border-[#A855F7]/30">
                        {props.lean.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-textMuted">Registered:</span>
                      <span className="font-bold text-white">{props.voters.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-textMuted">Support:</span>
                      <span className="font-bold text-[#00E5FF]">{ward.supportPct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-textMuted">Committed:</span>
                      <span className="font-bold text-white">{props.supporters}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </div>
      ) : (
        // Mapbox container element
        <div className="relative w-full h-[400px] rounded-lg border border-brand-border/40 overflow-hidden shadow-inner bg-[#090A0F]">
          <div ref={mapContainerRef} className="w-full h-full" />
          
          {!mapLoaded && (
            <div className="absolute inset-0 bg-[#090A0F]/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
              <div className="w-8 h-8 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs text-brand-textMuted font-bold uppercase tracking-wider animate-pulse">
                Initializing Vector Map...
              </span>
            </div>
          )}
        </div>
      )}

      {/* CNN Election Style Leading Legend */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 mt-4 bg-[#12131C] border border-brand-border/40 p-3 rounded-lg text-xs">
        <span className="font-extrabold text-brand-textActive uppercase tracking-wider text-[10px]">
          Ward Colors
        </span>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#A855F7]" />
            <span className="text-[#A855F7]">Kadzandani (Purple)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#FF9800]" />
            <span className="text-[#FF9800]">Kongowea (Orange)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#00B0FF]" />
            <span className="text-[#00B0FF]">Mkomani (Sky Blue)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#FFFFFF] border border-[#232535]" />
            <span className="text-[#FFFFFF]">Frere Town (White)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#00E5FF]" />
            <span className="text-[#00E5FF]">Ziwa La Ng'ombe (Turquoise)</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default InteractiveMap;
