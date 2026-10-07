import "server-only";
import { and, desc, devices, eq, getDb, sql, vehicles } from "@octopus/db";
import { HttpError } from "@/lib/api";

/* Todas las funciones reciben tenantId: el aislamiento multi-empresa vive aquí. */

// ------------------------------------------------------------------ dispositivos
export async function listDevices(tenantId: string) {
  return getDb()
    .select({
      id: devices.id,
      imei: devices.imei,
      name: devices.name,
      protocol: devices.protocol,
      phone: devices.phone,
      lastSeenAt: devices.lastSeenAt,
      createdAt: devices.createdAt,
      vehicleId: vehicles.id,
      vehicleName: vehicles.name,
    })
    .from(devices)
    .leftJoin(vehicles, eq(vehicles.deviceId, devices.id))
    .where(eq(devices.tenantId, tenantId))
    .orderBy(desc(devices.createdAt));
}

export async function createDevice(
  tenantId: string,
  input: { imei: string; name: string; protocol: string; phone?: string | null },
) {
  const [row] = await getDb()
    .insert(devices)
    .values({ tenantId, imei: input.imei, name: input.name, protocol: input.protocol, phone: input.phone ?? null })
    .returning();
  return row!;
}

export async function updateDevice(
  tenantId: string,
  id: string,
  input: Partial<{ name: string; protocol: string; phone: string | null }>,
) {
  const [row] = await getDb()
    .update(devices)
    .set(input)
    .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
    .returning();
  return row ?? null;
}

export async function deleteDevice(tenantId: string, id: string) {
  const rows = await getDb()
    .delete(devices)
    .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
    .returning({ imei: devices.imei });
  return rows[0] ?? null;
}

// ------------------------------------------------------------------ vehículos
export async function listVehicles(tenantId: string) {
  return getDb()
    .select({
      id: vehicles.id,
      name: vehicles.name,
      plate: vehicles.plate,
      color: vehicles.color,
      deviceId: vehicles.deviceId,
      deviceImei: devices.imei,
      lastSeenAt: devices.lastSeenAt,
    })
    .from(vehicles)
    .leftJoin(devices, eq(devices.id, vehicles.deviceId))
    .where(eq(vehicles.tenantId, tenantId))
    .orderBy(vehicles.name);
}

async function assertDeviceInTenant(tenantId: string, deviceId: string | null | undefined) {
  if (!deviceId) return;
  const [d] = await getDb()
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
    .limit(1);
  if (!d) throw new HttpError(404, "Dispositivo no encontrado");
}

export async function createVehicle(
  tenantId: string,
  input: { name: string; plate?: string | null; color?: string; deviceId?: string | null },
) {
  await assertDeviceInTenant(tenantId, input.deviceId);
  const [row] = await getDb()
    .insert(vehicles)
    .values({ tenantId, name: input.name, plate: input.plate ?? null, color: input.color, deviceId: input.deviceId ?? null })
    .returning();
  return row!;
}

export async function updateVehicle(
  tenantId: string,
  id: string,
  input: Partial<{ name: string; plate: string | null; color: string; deviceId: string | null }>,
) {
  await assertDeviceInTenant(tenantId, input.deviceId);
  const [row] = await getDb()
    .update(vehicles)
    .set(input)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
    .returning();
  return row ?? null;
}

export async function deleteVehicle(tenantId: string, id: string) {
  const rows = await getDb()
    .delete(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
    .returning({ id: vehicles.id });
  return rows[0] ?? null;
}

export async function fleetCounts(tenantId: string) {
  const [row] = await getDb().execute<{ vehicles: number; devices: number; online: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM vehicles WHERE tenant_id = ${tenantId}) AS vehicles,
      (SELECT count(*)::int FROM devices WHERE tenant_id = ${tenantId}) AS devices,
      (SELECT count(*)::int FROM devices WHERE tenant_id = ${tenantId} AND last_seen_at > now() - interval '5 minutes') AS online
  `);
  return row!;
}
