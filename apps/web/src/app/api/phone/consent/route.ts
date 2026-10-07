import { z } from "zod";
import { errorResponse, json, parseBody } from "@/lib/api";
import { phoneFromRequest } from "@/lib/phone-auth";
import { grantConsent } from "@/server/phones";

const schema = z.object({
  holderName: z.string().trim().min(2).max(100),
  accept: z.literal(true, { message: "Debes aceptar para compartir tu ubicación" }),
});

/** La persona que porta el teléfono acepta expresamente compartir su ubicación. */
export async function POST(req: Request) {
  try {
    const device = await phoneFromRequest(req);
    const { holderName } = await parseBody(req, schema);
    await grantConsent(device, holderName, req.headers.get("user-agent")?.slice(0, 300) ?? null);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
