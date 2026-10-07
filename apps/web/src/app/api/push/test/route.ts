import { HttpError, json, withAuth } from "@/lib/api";
import { services } from "@/lib/ingest";

/** Envía una notificación de prueba a los navegadores del usuario. */
export const POST = withAuth(async (_req, { session }) => {
  const { notifier } = services();
  if (!notifier.enabled) throw new HttpError(503, "Las notificaciones push no están configuradas (VAPID)");
  const sent = await notifier.notifyUser(session.userId, session.tenantId, {
    title: "Octopus Track",
    body: "Las notificaciones están activas en este dispositivo.",
    url: "/dashboard",
    tag: "test",
  });
  return json({ sent });
});
