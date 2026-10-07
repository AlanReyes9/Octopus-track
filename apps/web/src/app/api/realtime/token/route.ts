import { createRealtimeToken } from "@/lib/auth";
import { json, withAuth } from "@/lib/api";

/** Devuelve la URL y un token corto para conectar al gateway WebSocket. */
export const GET = withAuth(async (_req, { session }) => {
  const url = process.env.NEXT_PUBLIC_REALTIME_URL;
  const token = url ? await createRealtimeToken(session) : null;
  return json({ url: token ? url : null, token });
});
