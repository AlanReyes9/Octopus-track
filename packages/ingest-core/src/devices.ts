import { sql, type Database } from "@octopus/db";

/** Anota un IMEI desconocido y el protocolo con el que se conectó. */
export async function notePendingDevice(db: Database, imei: string, protocol: string, remoteAddr?: string | null) {
  await db.execute(sql`
    INSERT INTO pending_devices (imei, protocol, remote_addr)
    VALUES (${imei}, ${protocol}, ${remoteAddr ?? null})
    ON CONFLICT (imei) DO UPDATE SET
      protocol = EXCLUDED.protocol,
      remote_addr = COALESCE(EXCLUDED.remote_addr, pending_devices.remote_addr),
      last_seen = now(),
      messages = pending_devices.messages + 1
  `);
}

/** Ajusta el protocolo del dispositivo al detectado en la conexión real. */
export async function syncDeviceProtocol(db: Database, deviceId: string, protocol: string) {
  await db.execute(sql`
    UPDATE devices SET protocol = ${protocol}
    WHERE id = ${deviceId} AND kind = 'gps' AND protocol IS DISTINCT FROM ${protocol}
  `);
}

/** Datos de detección para un IMEI exacto (equipo registrado o pendiente). */
export async function detectionByImei(db: Database, imei: string) {
  const rows = await db.execute<{ protocol: string; last_seen: string; messages: number }>(sql`
    SELECT protocol, last_seen, messages FROM pending_devices WHERE imei = ${imei}
  `);
  const r = rows[0];
  return r ? { protocol: r.protocol, lastSeen: new Date(r.last_seen).toISOString(), messages: r.messages } : null;
}
