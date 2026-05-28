# tools/

One-shot scripts that aren't part of any app or package.

## `fetch-ward-boundaries.ts`

Generates `apps/web/components/map/ward-boundaries.ts` — the GeoJSON polygons used by the dashboard choropleth.

Run with:

```powershell
pnpm fetch:boundaries
```

### Data source priority

The script tries sources in this order, writing the first successful result:

1. **Local file at `tools/data/kenya-wards.geojson`** *(recommended)*  
   A manually-supplied FeatureCollection of Kenya ward boundaries. The script filters to the 5 Nyali wards by name and uses the geometry directly.

2. **OpenStreetMap via Overpass API**  
   Tried automatically if no local file exists. **Coverage of Kenyan wards in OSM is incomplete** — for Nyali Constituency specifically, no ward-level relations are mapped today. The query will run, find nothing useful, and proceed to the next step.

3. **Hand-crafted approximate polygons** *(current state)*  
   The script ships with rough placeholder shapes that roughly tile the Nyali area. These render correctly on the dashboard but aren't surveyor-grade.

After each run, `ward-boundaries.ts` records which source each ward came from in a `source` property (`'osm'` or `'fallback'`).

### Recommended path to real boundaries

The authoritative source is the **UN OCHA Common Operational Dataset for Kenya** — IEBC ward boundaries published for humanitarian use.

```
1. Visit:  https://data.humdata.org/dataset/cod-ab-ken
2. Download the adm3 (ward-level) layer.
3. If it's a Shapefile (.zip), convert in-browser at https://mapshaper.org:
     - Import → drop the .zip
     - Export → GeoJSON
4. Save the GeoJSON as:
     tools/data/kenya-wards.geojson
5. Run: pnpm fetch:boundaries
```

The script expects standard COD-AB property names: `ADM2_EN` for constituency, `ADM3_EN` for ward. If your dataset uses different keys, adjust the property reads in `fetch-ward-boundaries.ts`.

### Manual digitization fallback

If you don't have COD-AB access, you can trace ward boundaries by hand:

1. Visit https://overpass-turbo.eu
2. Pan to Mombasa and identify the 5 Nyali wards visually using OSM context
3. Use the **wizard** or write Overpass QL to query whatever boundary features are mappable nearby
4. Export as GeoJSON
5. Save to `tools/data/kenya-wards.geojson` with the property keys the script expects

### Attribution

If using OSM or OSM-derived data, the dashboard must display "© OpenStreetMap contributors" attribution.  
If using OCHA CODs, attribution is "Source: IEBC / OCHA Kenya".
