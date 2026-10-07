import { z } from "zod";
import { createSession, signupEnabled } from "@/lib/auth";
import { errorResponse, json, parseBody } from "@/lib/api";
import { passwordSchema } from "@/lib/schemas";
import { registerTenant } from "@/server/auth";

const schema = z.object({
  company: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: passwordSchema,
  acceptTerms: z.literal(true, { message: "Debes aceptar los términos y el aviso de privacidad" }),
});

export async function POST(req: Request) {
  try {
    if (!signupEnabled()) return json({ error: "El registro público está deshabilitado" }, 403);
    const input = await parseBody(req, schema);
    const { user, tenant, role } = await registerTenant(input);
    await createSession({ userId: user.id, tenantId: tenant.id, role, name: user.name });
    return json({ ok: true }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
