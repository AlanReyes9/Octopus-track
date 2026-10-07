import { vapidFromEnv } from "@octopus/ingest-core";
import { json } from "@/lib/api";

/** Clave pública VAPID para suscribirse (null si las notificaciones no están configuradas). */
export function GET() {
  return json({ publicKey: vapidFromEnv()?.publicKey ?? null });
}
