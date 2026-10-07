import { z } from "zod";
import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { deleteRule, setRuleEnabled } from "@/server/rules";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>(
  async (req, { session, params }) => {
    const { enabled } = await parseBody(req, z.object({ enabled: z.boolean() }));
    if (!(await setRuleEnabled(session.tenantId, (await params).id, enabled))) throw new HttpError(404, "Regla no encontrada");
    return json({ ok: true });
  },
  { manage: true },
);

export const DELETE = withAuth<Ctx>(
  async (_req, { session, params }) => {
    if (!(await deleteRule(session.tenantId, (await params).id))) throw new HttpError(404, "Regla no encontrada");
    return json({ ok: true });
  },
  { manage: true },
);
