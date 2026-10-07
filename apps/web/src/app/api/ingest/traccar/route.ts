import { decodeTraccar } from "@octopus/telemetry";
import { errorResponse, json } from "@/lib/api";
import { checkIngestToken, ingest } from "@/lib/ingest-http";

/**
 * Webhook para el forwarder de Traccar (variante serverless del servicio
 * apps/ingest). Configuración en traccar.xml:
 *   <entry key='forward.enable'>true</entry>
 *   <entry key='forward.json'>true</entry>
 *   <entry key='forward.url'>https://<app>/api/ingest/traccar?token=...</entry>
 */
export async function POST(req: Request) {
  try {
    const token = req.headers.get("x-ingest-token") ?? new URL(req.url).searchParams.get("token");
    if (!checkIngestToken(token)) return json({ error: "token inválido" }, 401);
    const body = await req.json().catch(() => null);
    return await ingest(() => decodeTraccar(body));
  } catch (err) {
    return errorResponse(err);
  }
}
