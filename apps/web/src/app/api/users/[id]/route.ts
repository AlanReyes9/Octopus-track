import { json, parseBody, withAuth } from "@/lib/api";
import { userUpdateSchema } from "@/lib/schemas";
import { removeTenantUser, updateTenantUser } from "@/server/users";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>(
  async (req, { session, params }) => {
    const { id } = await params;
    await updateTenantUser(session, id, await parseBody(req, userUpdateSchema));
    return json({ ok: true });
  },
  { manage: true },
);

export const DELETE = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    await removeTenantUser(session, id);
    return json({ ok: true });
  },
  { manage: true },
);
