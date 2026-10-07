import { errorResponse, json } from "@/lib/api";
import { phoneFromRequest } from "@/lib/phone-auth";
import { hasActiveConsent } from "@/server/phones";

export const dynamic = "force-dynamic";

/** Información mínima para la pantalla de consentimiento del teléfono. */
export async function GET(req: Request) {
  try {
    const d = await phoneFromRequest(req);
    return json({
      deviceName: d.name,
      company: d.company,
      holderName: d.consentName,
      consent: hasActiveConsent(d) ? "active" : d.consentRevokedAt ? "revoked" : "none",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
