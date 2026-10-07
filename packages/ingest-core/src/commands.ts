import { sql, type Database } from "@octopus/db";
import type { LiveMessage } from "@octopus/telemetry";
import type { LivePublisher } from "./publisher";

export interface PendingCommand {
  id: string;
  tenantId: string;
  deviceId: string;
  imei: string;
  type: string;
  params: Record<string, unknown>;
}

type FinalStatus = "sent" | "delivered" | "failed" | "cancelled";

/**
 * Cola de comandos persistida en `device_commands`. Los transportes (TCP,
 * gateway HTTP, teléfono) toman los pendientes y reportan el resultado.
 */
export function createCommandStore(db: Database, publisher: LivePublisher) {
  async function pendingForDevice(deviceId: string, limit = 10): Promise<PendingCommand[]> {
    const rows = await db.execute<Record<string, unknown>>(sql`
      SELECT c.id, c.tenant_id, c.device_id, d.imei, c.type, c.params
      FROM device_commands c JOIN devices d ON d.id = c.device_id
      WHERE c.device_id = ${deviceId} AND c.status = 'pending'
        AND c.created_at > now() - interval '24 hours'
      ORDER BY c.created_at
      LIMIT ${limit}
    `);
    return rows.map(toPending);
  }

  async function byId(id: string): Promise<PendingCommand | null> {
    const rows = await db.execute<Record<string, unknown>>(sql`
      SELECT c.id, c.tenant_id, c.device_id, d.imei, c.type, c.params
      FROM device_commands c JOIN devices d ON d.id = c.device_id
      WHERE c.id = ${id} AND c.status = 'pending'
    `);
    return rows[0] ? toPending(rows[0]) : null;
  }

  /** Cambia el estado (solo avanza; no reabre comandos terminados) y avisa en vivo. */
  async function mark(id: string, status: FinalStatus, result: string | null = null) {
    const rows = await db.execute<{ tenant_id: string; device_id: string }>(sql`
      UPDATE device_commands SET
        status = ${status}::command_status,
        result = COALESCE(${result}, result),
        sent_at = CASE WHEN ${status} = 'sent' THEN now() ELSE sent_at END,
        completed_at = CASE WHEN ${status} IN ('delivered', 'failed', 'cancelled') THEN now() ELSE completed_at END
      WHERE id = ${id} AND status IN ('pending', 'sent')
      RETURNING tenant_id, device_id
    `);
    const row = rows[0];
    if (!row) return false;
    const msg: LiveMessage = {
      type: "command",
      tenantId: row.tenant_id,
      deviceId: row.device_id,
      commandId: id,
      status,
      result,
    };
    await publisher.publish(msg).catch(() => {});
    return true;
  }

  return { pendingForDevice, byId, mark };
}

function toPending(r: Record<string, unknown>): PendingCommand {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    deviceId: r.device_id as string,
    imei: r.imei as string,
    type: r.type as string,
    params: (r.params as Record<string, unknown>) ?? {},
  };
}

export type CommandStore = ReturnType<typeof createCommandStore>;
