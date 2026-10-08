import { sql, type Database } from "@octopus/db";
import type { FcmSender } from "./fcm";
import { sendWebPush, type VapidKeys } from "./webpush";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface NotifierOptions {
  vapid: VapidKeys | null;
  /** Remitente FCM para la app Android (opcional). */
  fcm?: FcmSender | null;
}

type WebRow = { id: string; endpoint: string; p256dh: string; auth: string };
type MobileRow = { id: string; token: string };

/**
 * Envía notificaciones a los usuarios del tenant que pueden ver la unidad
 * (administradores o clientes con esa unidad asignada): Web Push en
 * navegadores y FCM en la app Android.
 */
export function createNotifier(db: Database, opts: NotifierOptions | VapidKeys | null) {
  // Compatibilidad: antes se pasaban solo las claves VAPID.
  const options: NotifierOptions =
    opts && "publicKey" in opts ? { vapid: opts, fcm: null } : (opts as NotifierOptions | null) ?? { vapid: null, fcm: null };
  const { vapid, fcm } = options;

  async function deliver(web: WebRow[], mobile: MobileRow[], payload: PushPayload) {
    const [webResults, mobileResults] = await Promise.all([
      vapid ? Promise.all(web.map((r) => sendWebPush(r, payload, vapid))) : Promise.resolve([]),
      fcm ? Promise.all(mobile.map((r) => fcm.send(r.token, payload))) : Promise.resolve([]),
    ]);
    const goneWeb = web.filter((_, i) => webResults[i] === "gone").map((r) => r.id);
    if (goneWeb.length) {
      await db.execute(sql`DELETE FROM push_subscriptions WHERE id IN (${sql.join(goneWeb.map((id) => sql`${id}::uuid`), sql`, `)})`);
    }
    const goneMobile = mobile.filter((_, i) => mobileResults[i] === "gone").map((r) => r.id);
    if (goneMobile.length) {
      await db.execute(sql`DELETE FROM mobile_push_tokens WHERE id IN (${sql.join(goneMobile.map((id) => sql`${id}::uuid`), sql`, `)})`);
    }
    return webResults.filter((r) => r === "sent").length + mobileResults.filter((r) => r === "sent").length;
  }

  async function notifyDevice(tenantId: string, deviceId: string, payload: PushPayload) {
    const canSee = sql`(m.role IN ('owner', 'admin') OR EXISTS (
      SELECT 1 FROM user_vehicle_access a JOIN vehicles v ON v.id = a.vehicle_id
      WHERE a.user_id = m.user_id AND v.device_id = ${deviceId}
    ))`;
    const web = vapid
      ? await db.execute<WebRow>(sql`
          SELECT s.id, s.endpoint, s.p256dh, s.auth
          FROM push_subscriptions s
          JOIN memberships m ON m.user_id = s.user_id AND m.tenant_id = s.tenant_id
          WHERE s.tenant_id = ${tenantId} AND ${canSee}`)
      : [];
    const mobile = fcm
      ? await db.execute<MobileRow>(sql`
          SELECT t.id, t.token
          FROM mobile_push_tokens t
          JOIN memberships m ON m.user_id = t.user_id AND m.tenant_id = t.tenant_id
          WHERE t.tenant_id = ${tenantId} AND ${canSee}`)
      : [];
    return deliver([...web], [...mobile], payload);
  }

  async function notifyUser(userId: string, tenantId: string, payload: PushPayload) {
    const web = vapid
      ? await db.execute<WebRow>(sql`
          SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId} AND tenant_id = ${tenantId}`)
      : [];
    const mobile = fcm
      ? await db.execute<MobileRow>(sql`
          SELECT id, token FROM mobile_push_tokens WHERE user_id = ${userId} AND tenant_id = ${tenantId}`)
      : [];
    return deliver([...web], [...mobile], payload);
  }

  return { enabled: Boolean(vapid || fcm), notifyDevice, notifyUser };
}

export type Notifier = ReturnType<typeof createNotifier>;
