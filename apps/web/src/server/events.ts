import "server-only";
import { getDb, sql } from "@octopus/db";
import { deviceFilter } from "./access";

export type DeviceEventType = "ignition_on" | "ignition_off" | "offline" | "online" | "low_battery";

export interface DeviceEventDto {
  time: string;
  type: DeviceEventType;
  message: string;
  deviceId: string;
  unit: string;
}

/** Eventos de cambio de estado (motor, conexión, batería) de los equipos visibles. */
export async function recentDeviceEvents(tenantId: string, visible: string[] | null = null, limit = 100) {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    SELECT e.time, e.type, e.message, e.device_id,
           COALESCE(v.name, d.name) AS unit
    FROM device_events e
    JOIN devices d ON d.id = e.device_id
    LEFT JOIN vehicles v ON v.device_id = d.id
    WHERE e.tenant_id = ${tenantId} AND e.time > now() - interval '30 days' AND ${deviceFilter(visible, sql.raw("e.device_id"))}
    ORDER BY e.time DESC LIMIT ${limit}
  `);
  return rows.map((r) => ({
    time: new Date(r.time as string).toISOString(),
    type: r.type as DeviceEventType,
    message: r.message as string,
    deviceId: r.device_id as string,
    unit: r.unit as string,
  })) satisfies DeviceEventDto[];
}
