import { HttpError, json, withAuth } from "@/lib/api";
import { deleteTemplate } from "@/server/templates";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    if (!(await deleteTemplate(session.tenantId, id))) throw new HttpError(404, "Plantilla no encontrada");
    return json({ ok: true });
  },
  { manage: true },
);
