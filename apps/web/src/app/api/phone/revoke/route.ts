import { errorResponse, json } from "@/lib/api";
import { phoneFromRequest } from "@/lib/phone-auth";
import { revokeConsent } from "@/server/phones";

/** Dejar de compartir: revoca el consentimiento de inmediato. */
export async function POST(req: Request) {
  try {
    const device = await phoneFromRequest(req);
    await revokeConsent(device, req.headers.get("user-agent")?.slice(0, 300) ?? null);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
