import { decodeOsmAnd } from "@octopus/telemetry";
import { errorResponse, json } from "@/lib/api";
import { ingest } from "@/lib/ingest-http";
import { findPhoneByToken, hasActiveConsent } from "@/server/phones";

/**
 * URL personal de un teléfono vinculado para apps de rastreo en segundo plano
 * que usan el protocolo HTTP OsmAnd:
 *   https://<app>/api/ingest/osmand/<token-de-vinculación>
 * Exige el consentimiento vigente aceptado en la página de vinculación.
 */
async function handler(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const device = await findPhoneByToken(token);
    if (!device) return json({ error: "enlace no válido" }, 401);
    if (!hasActiveConsent(device)) return json({ error: "sin consentimiento vigente" }, 403);
    const query = new URLSearchParams(new URL(req.url).search);
    if (req.method === "POST" && (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      new URLSearchParams(await req.text()).forEach((v, k) => query.set(k, v));
    }
    query.set("id", device.imei); // el identificador lo fija el servidor, no la app
    return await ingest(() => ({ ...decodeOsmAnd(query), source: "phone" }));
  } catch (err) {
    return errorResponse(err);
  }
}

export { handler as GET, handler as POST };
