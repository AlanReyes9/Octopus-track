import { json, parseBody, withAuth } from "@/lib/api";
import { userCreateSchema } from "@/lib/schemas";
import { createTenantUser, listTenantUsers } from "@/server/users";

export const GET = withAuth(async (_req, { session }) => json(await listTenantUsers(session.tenantId)), { manage: true });

export const POST = withAuth(
  async (req, { session }) => {
    const input = await parseBody(req, userCreateSchema);
    return json(await createTenantUser(session, input), 201);
  },
  { manage: true },
);
