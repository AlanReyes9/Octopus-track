import { decodeOsmAnd } from "@octopus/telemetry";
import { errorResponse, json } from "@/lib/api";
import { checkIngestToken, ingest } from "@/lib/ingest-http";

/** Protocolo OsmAnd (Traccar Client): https://<app>/api/ingest/osmand?token=...&id=IMEI&lat=..&lon=.. */
async function handler(req: Request) {
  try {
    const params = new URLSearchParams(new URL(req.url).search);
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/x-www-form-urlencoded")) {
        new URLSearchParams(await req.text()).forEach((v, k) => params.set(k, v));
      }
    }
    if (!checkIngestToken(params.get("token"))) return json({ error: "token inválido" }, 401);
    params.delete("token");
    return await ingest(() => decodeOsmAnd(params));
  } catch (err) {
    return errorResponse(err);
  }
}

export { handler as GET, handler as POST };
