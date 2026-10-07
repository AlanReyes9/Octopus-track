import { sql, type Database } from "@octopus/db";
import { coordToDecimal, type LiveMessage, type TelemetryEvent } from "@octopus/telemetry";
import type { LivePublisher } from "./publisher";

export interface DeviceRef {
  id: string;
  tenantId: string;
  vehicleId: string | null;
  imei: string;
  protocol: string;
  kind: string;
  /** Nombre visible de la unidad. */
  name: string;
}

export interface GeofenceTransition {
  geofenceId: string;
  geofenceName: string;
  type: "enter" | "exit";
}

export type ProcessResult =
  | { status: "stored"; device: DeviceRef; geofenceEvents: number }
  | { status: "duplicate"; device: DeviceRef }
  | { status: "unknown_device"; imei: string }
  | { status: "rejected"; reason: string };

export interface PipelineOptions {
  db: Database;
  publisher: LivePublisher;
  /** TTL de la caché IMEI → dispositivo. */
  deviceCacheTtlMs?: number;
  /** Rechaza fixes con más de este adelanto respecto al reloj del servidor. */
  maxFutureSkewMs?: number;
  /** Se invoca tras guardar transiciones de geocerca (automatizaciones). */
  onGeofenceTransitions?: (device: DeviceRef, transitions: GeofenceTransition[], event: TelemetryEvent) => Promise<void>;
}

/**
 * Procesador de tramas telemáticas normalizadas. Independiente del
 * transporte (HTTP, TCP, cola) y de la UI.
 *
 *   TelemetryEvent → resolver IMEI → guardar posición (hipertabla)
 *                  → actualizar última posición → evaluar geocercas (PostGIS)
 *                  → publicar en Redis
 */
export function createPipeline(opts: PipelineOptions) {
  const { db, publisher } = opts;
  const ttl = opts.deviceCacheTtlMs ?? 60_000;
  const maxSkew = opts.maxFutureSkewMs ?? 5 * 60_000;
  const cache = new Map<string, { ref: DeviceRef | null; expires: number }>();

  async function resolveDevice(imei: string): Promise<DeviceRef | null> {
    const hit = cache.get(imei);
    if (hit && hit.expires > Date.now()) return hit.ref;
    const rows = await db.execute<{
      id: string;
      tenant_id: string;
      vehicle_id: string | null;
      protocol: string;
      kind: string;
      name: string;
    }>(sql`
      SELECT d.id, d.tenant_id, v.id AS vehicle_id, d.protocol, d.kind, COALESCE(v.name, d.name) AS name
      FROM devices d LEFT JOIN vehicles v ON v.device_id = d.id
      WHERE d.imei = ${imei}
      LIMIT 1
    `);
    const row = rows[0];
    const ref = row
      ? { id: row.id, tenantId: row.tenant_id, vehicleId: row.vehicle_id, imei, protocol: row.protocol, kind: row.kind, name: row.name }
      : null;
    // Los IMEI desconocidos se cachean menos tiempo para que el alta sea rápida.
    cache.set(imei, { ref, expires: Date.now() + (ref ? ttl : Math.min(ttl, 10_000)) });
    return ref;
  }

  async function process(event: TelemetryEvent): Promise<ProcessResult> {
    if (event.timestamp.getTime() - Date.now() > maxSkew) {
      return { status: "rejected", reason: "timestamp en el futuro" };
    }
    const device = await resolveDevice(event.imei);
    if (!device) return { status: "unknown_device", imei: event.imei };

    const lat = coordToDecimal(event.latitude);
    const lon = coordToDecimal(event.longitude);
    const attrs = JSON.stringify(event.attributes);
    // drizzle + postgres.js no serializa Date en `sql` crudo: se envía ISO-8601.
    const ts = event.timestamp.toISOString();

    const geofenceMessages: LiveMessage[] = [];

    const inserted = await db.transaction(async (tx) => {
      const ins = await tx.execute<{ time: Date }>(sql`
        INSERT INTO positions (time, device_id, tenant_id, latitude, longitude, altitude,
                               speed_kmh, course, satellites, ignition, valid, attributes)
        VALUES (${ts}::timestamptz, ${device.id}, ${device.tenantId}, ${lat}::numeric, ${lon}::numeric,
                ${event.altitude}, ${event.speedKmh}, ${event.course}, ${event.satellites},
                ${event.ignition}, ${event.valid}, ${attrs}::jsonb)
        ON CONFLICT (device_id, time) DO NOTHING
        RETURNING time
      `);
      if (ins.length === 0) return false;

      // Solo avanza la última posición si el fix es más reciente (tramas fuera de orden).
      const latest = await tx.execute<{ device_id: string }>(sql`
        INSERT INTO device_last_positions AS l
          (device_id, tenant_id, time, latitude, longitude, altitude, speed_kmh, course, ignition, attributes)
        VALUES (${device.id}, ${device.tenantId}, ${ts}::timestamptz, ${lat}::numeric, ${lon}::numeric,
                ${event.altitude}, ${event.speedKmh}, ${event.course}, ${event.ignition}, ${attrs}::jsonb)
        ON CONFLICT (device_id) DO UPDATE SET
          time = EXCLUDED.time, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
          altitude = EXCLUDED.altitude, speed_kmh = EXCLUDED.speed_kmh, course = EXCLUDED.course,
          ignition = EXCLUDED.ignition, attributes = EXCLUDED.attributes
        WHERE l.time < EXCLUDED.time
        RETURNING device_id
      `);
      await tx.execute(sql`
        UPDATE devices SET last_seen_at = GREATEST(COALESCE(last_seen_at, ${ts}::timestamptz), ${ts}::timestamptz)
        WHERE id = ${device.id}
      `);

      // Las geocercas se evalúan solo con fixes válidos y en orden cronológico.
      if (latest.length > 0 && event.valid) {
        const transitions = await tx.execute<{ geofence_id: string; name: string; type: "enter" | "exit" }>(sql`
          WITH point AS (
            SELECT ST_SetSRID(ST_MakePoint(${event.longitude}, ${event.latitude}), 4326)::geography AS g
          ),
          inside AS (
            SELECT gf.id, gf.name FROM geofences gf, point
            WHERE gf.tenant_id = ${device.tenantId} AND ST_Covers(gf.area, point.g)
          ),
          previous AS (
            SELECT s.geofence_id AS id, gf.name
            FROM device_geofence_states s JOIN geofences gf ON gf.id = s.geofence_id
            WHERE s.device_id = ${device.id}
          )
          SELECT id AS geofence_id, name, 'enter' AS type FROM inside WHERE id NOT IN (SELECT id FROM previous)
          UNION ALL
          SELECT id AS geofence_id, name, 'exit' AS type FROM previous WHERE id NOT IN (SELECT id FROM inside)
        `);

        for (const t of transitions) {
          if (t.type === "enter") {
            await tx.execute(sql`
              INSERT INTO device_geofence_states (device_id, geofence_id, since)
              VALUES (${device.id}, ${t.geofence_id}, ${ts}::timestamptz) ON CONFLICT DO NOTHING
            `);
          } else {
            await tx.execute(sql`
              DELETE FROM device_geofence_states WHERE device_id = ${device.id} AND geofence_id = ${t.geofence_id}
            `);
          }
          await tx.execute(sql`
            INSERT INTO geofence_events (time, device_id, tenant_id, geofence_id, type, latitude, longitude)
            VALUES (${ts}::timestamptz, ${device.id}, ${device.tenantId}, ${t.geofence_id},
                    ${t.type}::geofence_event_type, ${lat}::numeric, ${lon}::numeric)
            ON CONFLICT DO NOTHING
          `);
          geofenceMessages.push({
            type: "geofence",
            tenantId: device.tenantId,
            deviceId: device.id,
            vehicleId: device.vehicleId,
            geofenceId: t.geofence_id,
            geofenceName: t.name,
            event: t.type,
            time: event.timestamp.toISOString(),
          });
        }
      }
      return true;
    });

    if (!inserted) return { status: "duplicate", device };

    if (geofenceMessages.length && opts.onGeofenceTransitions) {
      const transitions = geofenceMessages.flatMap((m) =>
        m.type === "geofence" ? [{ geofenceId: m.geofenceId, geofenceName: m.geofenceName, type: m.event }] : [],
      );
      await opts.onGeofenceTransitions(device, transitions, event).catch((err) =>
        console.error("[pipeline] fallo en automatizaciones de geocerca:", err),
      );
    }

    const messages: LiveMessage[] = [
      {
        type: "position",
        tenantId: device.tenantId,
        deviceId: device.id,
        vehicleId: device.vehicleId,
        time: event.timestamp.toISOString(),
        latitude: event.latitude,
        longitude: event.longitude,
        speedKmh: event.speedKmh,
        course: event.course,
        ignition: event.ignition,
      },
      ...geofenceMessages,
    ];
    // La publicación en vivo es "best effort": un fallo de Redis no pierde datos.
    await Promise.all(messages.map((m) => publisher.publish(m))).catch((err) =>
      console.error("[pipeline] fallo publicando en vivo:", err),
    );

    return { status: "stored", device, geofenceEvents: geofenceMessages.length };
  }

  return {
    process,
    /** Busca el dispositivo por IMEI (con caché). */
    resolve: resolveDevice,
    /** Invalida la caché (p. ej. tras reasignar un dispositivo). */
    invalidate: (imei?: string) => (imei ? cache.delete(imei) : cache.clear()),
  };
}

export type Pipeline = ReturnType<typeof createPipeline>;
