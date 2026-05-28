import { customType } from 'drizzle-orm/pg-core';

// PostGIS geometry column types.
//
// Drizzle does not ship PostGIS support out of the box. We define custom column types
// that map to `geometry(<Subtype>, 4326)` (WGS-84 lat/lon).
//
// SRS FR-010 — every ward/sub-location/village/polling-station has a geometry.
// Boundary polygons are optional for informal settlements (centroid-only is permitted
// per BR-010.1); the application surfaces the uncertainty in the UI.
//
// Reads: returns the WKB hex string. Use ST_GeomFromText / ST_AsGeoJSON in SQL when
// you need GeoJSON for the map layer.
// Writes: expects either WKB hex or a GeoJSON Feature; the API layer normalises to
// WKT before insert.

export const geometryPoint = customType<{
  data: string; // WKT or GeoJSON-serialised — caller's responsibility to normalise
  driverData: string;
}>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

export const geometryPolygon = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(Polygon, 4326)';
  },
});

export const geometryMultiPolygon = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(MultiPolygon, 4326)';
  },
});
