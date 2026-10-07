import "server-only";
import { HttpError } from "@/lib/api";
import { findPhoneByToken, hasActiveConsent, type PhoneDevice } from "@/server/phones";

/** Resuelve el teléfono a partir de `Authorization: Bearer <token de vinculación>`. */
export async function phoneFromRequest(req: Request, opts: { requireConsent?: boolean } = {}): Promise<PhoneDevice> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const device = await findPhoneByToken(token);
  if (!device) throw new HttpError(401, "Enlace de seguimiento no válido o revocado");
  if (opts.requireConsent && !hasActiveConsent(device)) throw new HttpError(403, "No hay consentimiento vigente");
  return device;
}
