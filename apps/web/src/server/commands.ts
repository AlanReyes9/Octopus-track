import "server-only";
import { and, desc, deviceCommands, deviceLastPositions, devices, eq, getDb } from "@octopus/db";
import { commandsFor, ENGINE_STOP_MAX_SPEED_KMH, getCommand } from "@octopus/telemetry";
import { services } from "@/lib/ingest";
import { HttpError } from "@/lib/api";
import type { Session } from "@/lib/auth";

const commandServices = () => {
  const { commands, publisher } = services();
  return { store: commands, publisher };
};

/** Protocolo efectivo para comandos (los teléfonos usan "phone"). */
export function protocolOf(d: { kind: string; protocol: string }): string {
  return d.kind === "phone" ? "phone" : d.protocol;
}

export async function listCommands(tenantId: string, deviceId: string, limit = 20) {
  return getDb()
    .select({
      id: deviceCommands.id,
      type: deviceCommands.type,
      params: deviceCommands.params,
      status: deviceCommands.status,
      result: deviceCommands.result,
      createdAt: deviceCommands.createdAt,
      completedAt: deviceCommands.completedAt,
    })
    .from(deviceCommands)
    .where(and(eq(deviceCommands.tenantId, tenantId), eq(deviceCommands.deviceId, deviceId)))
    .orderBy(desc(deviceCommands.createdAt))
    .limit(limit);
}

export async function enqueueCommand(
  session: Session,
  deviceId: string,
  type: string,
  rawParams: Record<string, unknown>,
) {
  const db = getDb();
  const [device] = await db
    .select({ id: devices.id, imei: devices.imei, kind: devices.kind, protocol: devices.protocol })
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, session.tenantId)))
    .limit(1);
  if (!device) throw new HttpError(404, "Dispositivo no encontrado");

  const def = getCommand(type);
  const protocol = protocolOf(device);
  if (!def || !commandsFor(protocol).some((c) => c.type === type)) {
    throw new HttpError(400, "Este equipo no admite ese comando");
  }

  // Valida y normaliza parámetros según el catálogo.
  const params: Record<string, string | number> = {};
  for (const p of def.params ?? []) {
    const v = rawParams[p.key];
    if (p.kind === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || (p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) {
        throw new HttpError(400, `Valor inválido para "${p.label}"`);
      }
      params[p.key] = Math.round(n);
    } else {
      const s = String(v ?? "").trim();
      if (!s || (p.maxLength && s.length > p.maxLength)) throw new HttpError(400, `Valor inválido para "${p.label}"`);
      params[p.key] = s;
    }
  }

  // Seguridad: el bloqueo de motor solo con el vehículo detenido y posición reciente.
  if (type === "engineStop") {
    const [last] = await db
      .select({ time: deviceLastPositions.time, speed: deviceLastPositions.speedKmh })
      .from(deviceLastPositions)
      .where(eq(deviceLastPositions.deviceId, device.id))
      .limit(1);
    const fresh = last && Date.now() - last.time.getTime() < 10 * 60_000;
    if (!fresh || last.speed === null || last.speed > ENGINE_STOP_MAX_SPEED_KMH) {
      throw new HttpError(
        409,
        `Por seguridad, el motor solo puede bloquearse con el vehículo detenido (≤ ${ENGINE_STOP_MAX_SPEED_KMH} km/h) y con una posición de los últimos 10 minutos.`,
      );
    }
  }

  const { store } = commandServices();
  const id = await store.enqueue({ tenantId: session.tenantId, deviceId: device.id, createdBy: session.userId, type, params });
  await store.dispatch(id, device, type, params);
  return { id };
}

export async function cancelCommand(tenantId: string, commandId: string) {
  const [row] = await getDb()
    .select({ id: deviceCommands.id })
    .from(deviceCommands)
    .where(and(eq(deviceCommands.id, commandId), eq(deviceCommands.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new HttpError(404, "Comando no encontrado");
  return commandServices().store.mark(commandId, "cancelled", "Cancelado por el usuario");
}

/** Comandos pendientes para un teléfono; se marcan como entregados al leerlos. */
export async function takePhoneCommands(deviceId: string) {
  const { store } = commandServices();
  const pending = await store.pendingForDevice(deviceId);
  for (const c of pending) await store.mark(c.id, "delivered", null);
  return pending.map((c) => ({ id: c.id, type: c.type, params: c.params }));
}
