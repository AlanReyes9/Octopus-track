import { HttpError, json, withAuth } from "@/lib/api";
import { cancelCommand } from "@/server/commands";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    if (!(await cancelCommand(session.tenantId, id))) throw new HttpError(409, "El comando ya no se puede cancelar");
    return json({ ok: true });
  },
  { manage: true },
);
