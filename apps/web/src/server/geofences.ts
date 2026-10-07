import "server-only";
import { getDb, sql } from "@octopus/db";

export interface GeofenceDto {
  id: string;
  name: string;
  color: string;
  /** GeoJSON Polygon */
  geometry: { type: "Polygon"; coordinates: number[][][] };
  areaKm2: number;
  createdAt: string;
}

export async function listGeofences(tenantId: string): Promise<GeofenceDto[]> {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    SELECT id, name, color, ST_AsGeoJSON(area, 7)::json AS geometry,
           ST_Area(area) / 1e6 AS area_km2, created_at
    FROM geofences WHERE tenant_id = ${tenantId} ORDER BY name
  `);
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    color: r.color as string,
    geometry: r.geometry as GeofenceDto["geometry"],
    areaKm2: Number(r.area_km2),
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

/** ring: [[lng, lat], ...] — se cierra automáticamente y se valida con PostGIS. */
export async function createGeofence(tenantId: string, input: { name: string; color: string; ring: [number, number][] }) {
  const ring = [...input.ring];
  const first = ring[0]!;
  const last = ring.at(-1)!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  const geojson = JSON.stringify({ type: "Polygon", coordinates: [ring] });
  const rows = await getDb().execute<{ id: string; valid: boolean }>(sql`
    WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326) AS geom)
    INSERT INTO geofences (tenant_id, name, color, area)
    SELECT ${tenantId}, ${input.name}, ${input.color}, geom::geography FROM g WHERE ST_IsValid(geom)
    RETURNING id
  `);
  return rows[0]?.id ?? null;
}

export async function deleteGeofence(tenantId: string, id: string) {
  const rows = await getDb().execute(sql`
    DELETE FROM geofences WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
  `);
  return rows.length > 0;
}

export async function recentGeofenceEvents(tenantId: string, limit = 50) {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    SELECT e.time, e.type, e.latitude, e.longitude, g.name AS geofence_name, g.color,
           d.name AS device_name, v.name AS vehicle_name
    FROM geofence_events e
    JOIN geofences g ON g.id = e.geofence_id
    JOIN devices d ON d.id = e.device_id
    LEFT JOIN vehicles v ON v.device_id = d.id
    WHERE e.tenant_id = ${tenantId} AND e.time > now() - interval '30 days'
    ORDER BY e.time DESC LIMIT ${limit}
  `);
  return rows.map((r) => ({
    time: new Date(r.time as string).toISOString(),
    type: r.type as "enter" | "exit",
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    geofenceName: r.geofence_name as string,
    color: r.color as string,
    unit: (r.vehicle_name as string) ?? (r.device_name as string),
  }));
}
