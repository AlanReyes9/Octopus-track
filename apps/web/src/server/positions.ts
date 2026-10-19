import "server-only";
import { getDb, sql } from "@octopus/db";
import { deviceFilter } from "./access";
import { pathLengthMeters } from "@octopus/telemetry";

export interface LivePosition {
  deviceId: string;
  deviceName: string;
  imei: string;
  vehicleId: string | null;
  vehicleName: string | null;
  plate: string | null;
  color: string;
  icon: string;
  kind: "gps" | "phone";
  protocol: string;
  attributes: Record<string, unknown>;
  time: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  course: number | null;
  ignition: boolean | null;
}

/** Última posición de cada dispositivo del tenant. */
export async function latestPositions(tenantId: string, visible: string[] | null = null): Promise<LivePosition[]> {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    SELECT l.device_id, d.name AS device_name, d.imei, v.id AS vehicle_id, v.name AS vehicle_name, v.plate,
           COALESCE(v.color, '#7c3aed') AS color, COALESCE(v.icon, CASE WHEN d.kind = 'phone' THEN 'person' ELSE 'car' END) AS icon, d.kind, d.protocol, l.attributes, l.time, l.latitude, l.longitude, l.speed_kmh, l.course, l.ignition
    FROM device_last_positions l
    JOIN devices d ON d.id = l.device_id
    LEFT JOIN vehicles v ON v.device_id = d.id
    WHERE l.tenant_id = ${tenantId} AND ${deviceFilter(visible, sql.raw("l.device_id"))}
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
    icon: r.icon as string,
    kind: r.kind as "gps" | "phone",
    protocol: r.protocol as string,
    attributes: (r.attributes as Record<string, unknown>) ?? {},
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

export interface StopDto {
  start: string;
  end: string;
  durationSeconds: number;
  latitude: number;
  longitude: number;
}

export interface StopsReport {
  deviceId: string;
  from: string;
  to: string;
  stops: StopDto[];
  totalStops: number;
  totalStoppedSeconds: number;
}

const DEFAULT_SPEED_THRESHOLD_KMH = 3;
const DEFAULT_MIN_STOP_SECONDS = 120;

/**
 * Paradas de un equipo en un rango: tramos de posiciones consecutivas por
 * debajo del umbral de velocidad, de al menos `minStopSeconds`. Se calcula
 * directamente en SQL (técnica "gaps and islands") para no traer miles de
 * puntos a Node en rangos largos — a diferencia de deviceHistory(), nunca
 * se submuestrea: un punto de más o de menos cambiaría la duración real.
 */
export async function deviceStops(
  tenantId: string,
  deviceId: string,
  from: Date,
  to: Date,
  opts: { speedThresholdKmh?: number; minStopSeconds?: number } = {},
): Promise<StopsReport> {
  const speedThreshold = opts.speedThresholdKmh ?? DEFAULT_SPEED_THRESHOLD_KMH;
  const minStopSeconds = opts.minStopSeconds ?? DEFAULT_MIN_STOP_SECONDS;
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const rows = await getDb().execute<{
    start_time: string;
    end_time: string;
    duration_seconds: number;
    latitude: number;
    longitude: number;
  }>(sql`
    WITH pts AS (
      SELECT time, latitude, longitude, (COALESCE(speed_kmh, 0) <= ${speedThreshold}) AS stopped
      FROM positions
      WHERE tenant_id = ${tenantId} AND device_id = ${deviceId} AND time BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
    ),
    grouped AS (
      SELECT *,
        row_number() OVER (ORDER BY time) - row_number() OVER (PARTITION BY stopped ORDER BY time) AS grp
      FROM pts
    )
    SELECT
      min(time) AS start_time,
      max(time) AS end_time,
      EXTRACT(EPOCH FROM (max(time) - min(time)))::int AS duration_seconds,
      avg(latitude)::float8 AS latitude,
      avg(longitude)::float8 AS longitude
    FROM grouped
    WHERE stopped
    GROUP BY grp
    HAVING EXTRACT(EPOCH FROM (max(time) - min(time))) >= ${minStopSeconds}
    ORDER BY min(time)
  `);

  const stops: StopDto[] = rows.map((r) => ({
    start: new Date(r.start_time).toISOString(),
    end: new Date(r.end_time).toISOString(),
    durationSeconds: Number(r.duration_seconds),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }));

  return {
    deviceId,
    from: fromIso,
    to: toIso,
    stops,
    totalStops: stops.length,
    totalStoppedSeconds: stops.reduce((sum, s) => sum + s.durationSeconds, 0),
  };
}
