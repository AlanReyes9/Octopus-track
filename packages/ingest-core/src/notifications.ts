import { sql, type Database } from "@octopus/db";
import { sendWebPush, type VapidKeys } from "./webpush";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envía notificaciones push a los usuarios del tenant que pueden ver la
 * unidad (administradores o clientes con esa unidad asignada).
 */
export function createNotifier(db: Database, vapid: VapidKeys | null) {
  async function deliver(rows: { id: string; endpoint: string; p256dh: string; auth: string }[], payload: PushPayload) {
    if (!vapid || rows.length === 0) return 0;
    const results = await Promise.all(rows.map((r) => sendWebPush(r, payload, vapid)));
    const gone = rows.filter((_, i) => results[i] === "gone").map((r) => r.id);
    if (gone.length) {
      await db.execute(sql`DELETE FROM push_subscriptions WHERE id IN (${sql.join(gone.map((id) => sql`${id}::uuid`), sql`, `)})`);
    }
    return results.filter((r) => r === "sent").length;
  }

  async function notifyDevice(tenantId: string, deviceId: string, payload: PushPayload) {
    const rows = await db.execute<{ id: string; endpoint: string; p256dh: string; auth: string }>(sql`
      SELECT s.id, s.endpoint, s.p256dh, s.auth
      FROM push_subscriptions s
      JOIN memberships m ON m.user_id = s.user_id AND m.tenant_id = s.tenant_id
      WHERE s.tenant_id = ${tenantId}
        AND (m.role IN ('owner', 'admin') OR EXISTS (
          SELECT 1 FROM user_vehicle_access a JOIN vehicles v ON v.id = a.vehicle_id
          WHERE a.user_id = s.user_id AND v.device_id = ${deviceId}
        ))
    `);
    return deliver([...rows], payload);
  }

  async function notifyUser(userId: string, tenantId: string, payload: PushPayload) {
    const rows = await db.execute<{ id: string; endpoint: string; p256dh: string; auth: string }>(sql`
      SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId} AND tenant_id = ${tenantId}
    `);
    return deliver([...rows], payload);
  }

  return { enabled: Boolean(vapid), notifyDevice, notifyUser };
}

export type Notifier = ReturnType<typeof createNotifier>;
