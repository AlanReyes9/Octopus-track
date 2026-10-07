import "server-only";
import { getDb, sql } from "@octopus/db";
import { pathLengthMeters } from "@octopus/telemetry";

export interface LivePosition {
  deviceId: string;
  deviceName: string;
  imei: string;
  vehicleId: string | null;
  vehicleName: string | null;
  plate: string | null;
  color: string;
  time: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  course: number | null;
  ignition: boolean | null;
}

/** Última posición de cada dispositivo del tenant. */
export async function latestPositions(tenantId: string): Promise<LivePosition[]> {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    SELECT l.device_id, d.name AS device_name, d.imei, v.id AS vehicle_id, v.name AS vehicle_name, v.plate,
           COALESCE(v.color, '#64748b') AS color, l.time, l.latitude, l.longitude, l.speed_kmh, l.course, l.ignition
    FROM device_last_positions l
    JOIN devices d ON d.id = l.device_id
    LEFT JOIN vehicles v ON v.device_id = d.id
    WHERE l.tenant_id = ${tenantId}
    ORDER BY COALESCE(v.name, d.name)
  `);
  return rows.map((r) => ({
    deviceId: r.device_id as string,
    deviceName: r.device_name as string,
    imei: r.imei as string,
    vehicleId: (r.vehicle_id as string) ?? null,
    vehicleName: (r.vehicle_name as string) ?? null,
    plate: (r.plate as string) ?? null,
    color: r.color as string,
    time: new Date(r.time as string).toISOString(),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    speedKmh: r.speed_kmh as number | null,
    course: r.course as number | null,
    ignition: r.ignition as boolean | null,
  }));
}

export interface HistoryPoint {
  time: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  course: number | null;
  ignition: boolean | null;
}

const MAX_HISTORY_POINTS = 20_000;

/**
 * Recorrido de un dispositivo en un rango. Si hay demasiados puntos se
 * submuestrea por intervalos (date_bin) para mantener la respuesta ligera;
 * el filtro por tiempo aprovecha la exclusión de chunks de la hipertabla.
 */
export async function deviceHistory(tenantId: string, deviceId: string, from: Date, to: Date) {
  const db = getDb();
  // drizzle + postgres.js no serializa Date en `sql` crudo: se envía ISO-8601.
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const countRows = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count FROM positions
    WHERE tenant_id = ${tenantId} AND device_id = ${deviceId} AND time BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
  `);
  const count = countRows[0]?.count ?? 0;

  let rows: Record<string, unknown>[];
  if (count > MAX_HISTORY_POINTS) {
    const bucketSeconds = Math.ceil((to.getTime() - from.getTime()) / 1000 / MAX_HISTORY_POINTS);
    rows = await db.execute(sql`
      SELECT date_bin(make_interval(secs => ${bucketSeconds}), time, TIMESTAMPTZ 'epoch') AS time,
             (array_agg(latitude ORDER BY time DESC))[1] AS latitude,
             (array_agg(longitude ORDER BY time DESC))[1] AS longitude,
             max(speed_kmh) AS speed_kmh,
             (array_agg(course ORDER BY time DESC))[1] AS course,
             bool_or(ignition) AS ignition
      FROM positions
      WHERE tenant_id = ${tenantId} AND device_id = ${deviceId} AND time BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
      GROUP BY 1 ORDER BY 1
    `);
  } else {
    rows = await db.execute(sql`
      SELECT time, latitude, longitude, speed_kmh, course, ignition
      FROM positions
      WHERE tenant_id = ${tenantId} AND device_id = ${deviceId} AND time BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
      ORDER BY time
    `);
  }

  const points: HistoryPoint[] = rows.map((r) => ({
    time: new Date(r.time as string).toISOString(),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    speedKmh: r.speed_kmh as number | null,
    course: r.course as number | null,
    ignition: r.ignition as boolean | null,
  }));

  const speeds = points.map((p) => p.speedKmh ?? 0);
  return {
    points,
    totalPoints: count,
    sampled: count > MAX_HISTORY_POINTS,
    summary: {
      distanceKm: pathLengthMeters(points) / 1000,
      maxSpeedKmh: speeds.length ? Math.max(...speeds) : 0,
      avgSpeedKmh: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      start: points[0]?.time ?? null,
      end: points.at(-1)?.time ?? null,
    },
  };
}
