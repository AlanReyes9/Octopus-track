import { decodeJsonGateway } from "@octopus/telemetry";
import { errorResponse, json } from "@/lib/api";
import { checkIngestToken, ingest } from "@/lib/ingest-http";

/**
 * Gateway HTTP JSON: recibe posiciones reenviadas por un servidor de
 * protocolos GPS externo en formato `{ position, device }`.
 *   POST https://<app>/api/ingest/gateway   (cabecera X-Ingest-Token)
 */
export async function POST(req: Request) {
  try {
    const token = req.headers.get("x-ingest-token") ?? new URL(req.url).searchParams.get("token");
    if (!checkIngestToken(token)) return json({ error: "token inválido" }, 401);
    const body = await req.json().catch(() => null);
    return await ingest(() => decodeJsonGateway(body));
  } catch (err) {
    return errorResponse(err);
  }
}
