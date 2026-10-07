import { z } from "zod";
import { createSession } from "@/lib/auth";
import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { getMembership } from "@/server/auth";

const schema = z.object({ tenantId: z.uuid() });

/** Cambia la empresa activa de la sesión (usuarios con varias membresías). */
export const POST = withAuth(async (req, { session }) => {
  const { tenantId } = await parseBody(req, schema);
  const m = await getMembership(session.userId, tenantId);
  if (!m) throw new HttpError(403, "Sin acceso a esa empresa");
  await createSession({ ...session, tenantId, role: m.role });
  return json({ ok: true });
});
