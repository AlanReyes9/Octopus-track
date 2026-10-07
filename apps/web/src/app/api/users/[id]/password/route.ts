import { json, withAuth } from "@/lib/api";
import { resetTenantUserPassword } from "@/server/users";

type Ctx = { params: Promise<{ id: string }> };

/** Genera una contraseña temporal; el usuario deberá cambiarla al entrar. */
export const POST = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    return json({ temporaryPassword: await resetTenantUserPassword(session, id) });
  },
  { manage: true },
);
