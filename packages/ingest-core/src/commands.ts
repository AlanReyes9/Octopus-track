import { sql, type Database } from "@octopus/db";
import { isTcpNative, type LiveMessage } from "@octopus/telemetry";
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
export interface CommandStoreOptions {
  /** Entrega a equipos TCP (por defecto: aviso por Redis al servicio de ingesta). */
  onTcpCommand?: (commandId: string) => void | Promise<void>;
}

export function createCommandStore(db: Database, publisher: LivePublisher, opts: CommandStoreOptions = {}) {
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

  /** Inserta un comando en la cola. */
  async function enqueue(input: {
    tenantId: string;
    deviceId: string;
    createdBy: string | null;
    type: string;
    params: Record<string, unknown>;
  }): Promise<string> {
    const rows = await db.execute<{ id: string }>(sql`
      INSERT INTO device_commands (tenant_id, device_id, created_by, type, params)
      VALUES (${input.tenantId}, ${input.deviceId}, ${input.createdBy}, ${input.type}, ${JSON.stringify(input.params)}::jsonb)
      RETURNING id
    `);
    return rows[0]!.id;
  }

  /**
   * Encamina el comando según el protocolo: TCP nativo → servicio de ingesta;
   * teléfono → lo recoge en su siguiente reporte; resto → gateway HTTP externo.
   */
  async function dispatch(id: string, device: { imei: string; protocol: string; kind: string }, type: string, params: Record<string, unknown>) {
    const protocol = device.kind === "phone" ? "phone" : device.protocol;
    if (protocol === "phone") return;
    if (isTcpNative(protocol)) {
      await (opts.onTcpCommand ?? ((cid: string) => publisher.notifyCommand(cid)))(id);
      return;
    }
    const url = process.env.COMMANDS_WEBHOOK_URL;
    if (!url) {
      await mark(id, "failed", "No hay un gateway de comandos configurado (COMMANDS_WEBHOOK_URL)");
      return;
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.COMMANDS_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.COMMANDS_WEBHOOK_TOKEN}` } : {}),
        },
        body: JSON.stringify({ id, imei: device.imei, protocol, type, params }),
        signal: AbortSignal.timeout(8000),
      });
      await mark(id, res.ok ? "sent" : "failed", res.ok ? null : `El gateway respondió ${res.status}`);
    } catch (err) {
      await mark(id, "failed", `Gateway no disponible: ${(err as Error).message}`);
    }
  }

  return { pendingForDevice, byId, mark, enqueue, dispatch };
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
