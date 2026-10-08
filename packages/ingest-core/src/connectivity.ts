import { sql, type Database } from "@octopus/db";

const OFFLINE_AFTER_MS = 5 * 60_000; // igual que isOnline() en la web/app

export interface ConnectivityEvent {
  deviceId: string;
  tenantId: string;
  type: "offline" | "online";
  message: string;
}

/**
 * Compara el último reporte de cada equipo con el último evento offline/online
 * guardado y devuelve las transiciones nuevas (se insertan y notifican aparte,
 * vía insertAndNotify más abajo). Pensado para llamarse periódicamente desde
 * un proceso de larga duración (apps/ingest) o desde el cron de Vercel.
 */
export async function detectConnectivityChanges(db: Database): Promise<ConnectivityEvent[]> {
  const rows = await db.execute<{
    id: string;
    tenant_id: string;
    name: string;
    last_seen_at: string | null;
    last_status: "offline" | "online" | null;
  }>(sql`
    WITH last_status AS (
      SELECT DISTINCT ON (device_id) device_id, type
      FROM device_events WHERE type IN ('offline', 'online')
      ORDER BY device_id, time DESC
    )
    SELECT d.id, d.tenant_id, COALESCE(v.name, d.name) AS name, d.last_seen_at, ls.type AS last_status
    FROM devices d
    LEFT JOIN vehicles v ON v.device_id = d.id
    LEFT JOIN last_status ls ON ls.device_id = d.id
    WHERE d.last_seen_at IS NOT NULL
  `);
  const now = Date.now();
  const events: ConnectivityEvent[] = [];
  for (const r of rows) {
    const stale = now - new Date(r.last_seen_at!).getTime() > OFFLINE_AFTER_MS;
    if (stale && r.last_status !== "offline") {
      events.push({ deviceId: r.id, tenantId: r.tenant_id, type: "offline", message: `${r.name}: se perdió la conexión` });
    } else if (!stale && r.last_status === "offline") {
      events.push({ deviceId: r.id, tenantId: r.tenant_id, type: "online", message: `${r.name}: conexión restablecida` });
    }
  }
  return events;
}

export async function insertConnectivityEvents(db: Database, events: ConnectivityEvent[]) {
  for (const e of events) {
    await db.execute(sql`
      INSERT INTO device_events (device_id, tenant_id, type, message)
      VALUES (${e.deviceId}, ${e.tenantId}, ${e.type}::device_event_type, ${e.message})
    `);
  }
}
