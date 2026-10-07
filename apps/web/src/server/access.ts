import "server-only";
import { getDb, sql } from "@octopus/db";
import { HttpError } from "@/lib/api";
import { canManage, type Session } from "@/lib/auth";

/**
 * Dispositivos visibles para la sesión.
 *  - null  → administrador/propietario: todo el tenant.
 *  - array → cliente (viewer): solo los dispositivos de sus vehículos asignados.
 */
export async function visibleDeviceIds(session: Session): Promise<string[] | null> {
  if (canManage(session.role)) return null;
  const rows = await getDb().execute<{ device_id: string }>(sql`
    SELECT v.device_id FROM user_vehicle_access a
    JOIN vehicles v ON v.id = a.vehicle_id
    WHERE a.user_id = ${session.userId} AND a.tenant_id = ${session.tenantId} AND v.device_id IS NOT NULL
  `);
  return rows.map((r) => r.device_id);
}

export async function visibleVehicleIds(session: Session): Promise<string[] | null> {
  if (canManage(session.role)) return null;
  const rows = await getDb().execute<{ vehicle_id: string }>(sql`
    SELECT vehicle_id FROM user_vehicle_access WHERE user_id = ${session.userId} AND tenant_id = ${session.tenantId}
  `);
  return rows.map((r) => r.vehicle_id);
}

export async function assertDeviceVisible(session: Session, deviceId: string) {
  const ids = await visibleDeviceIds(session);
  if (ids && !ids.includes(deviceId)) throw new HttpError(404, "Unidad no encontrada");
}

/** Fragmento SQL para filtrar por dispositivo visible (columna dada). */
export function deviceFilter(ids: string[] | null, column = sql.raw("device_id")) {
  if (ids === null) return sql`TRUE`;
  if (ids.length === 0) return sql`FALSE`;
  return sql`${column} IN (${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}
