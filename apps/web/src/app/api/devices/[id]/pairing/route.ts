import { HttpError, json, withAuth } from "@/lib/api";
import { pairingUrl, regeneratePhoneToken } from "@/server/phones";

type Ctx = { params: Promise<{ id: string }> };

/** Genera un enlace de vinculación nuevo (invalida el anterior y su consentimiento). */
export const POST = withAuth<Ctx>(
  async (req, { session, params }) => {
    const { id } = await params;
    const token = await regeneratePhoneToken(session.tenantId, id);
    if (!token) throw new HttpError(404, "Teléfono no encontrado");
    return json({ pairingUrl: pairingUrl(new URL(req.url).origin, token) });
  },
  { manage: true },
);
