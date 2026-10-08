import { z } from "zod";
import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { getMembership } from "@/server/auth";
import { issueMobileToken, mobileProfile } from "@/server/mobile";

/** Cambia de empresa y devuelve un token nuevo para ella. */
export const POST = withAuth(async (req, { session }) => {
  const { tenantId } = await parseBody(req, z.object({ tenantId: z.uuid() }));
  const m = await getMembership(session.userId, tenantId);
  if (!m) throw new HttpError(403, "Sin acceso a esa empresa");
  const next = { ...session, tenantId, role: m.role };
  const { token, expiresAt } = await issueMobileToken(next);
  return json({ token, expiresAt: expiresAt.toISOString(), ...(await mobileProfile(next)) });
});
