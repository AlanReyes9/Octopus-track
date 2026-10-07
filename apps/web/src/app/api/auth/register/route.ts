import { z } from "zod";
import { createSession } from "@/lib/auth";
import { errorResponse, json, parseBody } from "@/lib/api";
import { registerTenant } from "@/server/auth";

const schema = z.object({
  company: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_SIGNUP === "false") return json({ error: "Registro deshabilitado" }, 403);
    const input = await parseBody(req, schema);
    const { user, tenant, role } = await registerTenant(input);
    await createSession({ userId: user.id, tenantId: tenant.id, role, name: user.name });
    return json({ ok: true }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
