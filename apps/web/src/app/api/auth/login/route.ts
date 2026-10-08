import { z } from "zod";
import { createSession } from "@/lib/auth";
import { errorResponse, json, parseBody } from "@/lib/api";
import { clientIp, lockedFor, loginKey, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { verifyCredentials } from "@/server/auth";

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { email, password } = await parseBody(req, schema);
    const key = loginKey(email, clientIp(req));
    if (lockedFor(key)) return json({ error: "Demasiados intentos. Espera unos minutos." }, 429);
    const result = await verifyCredentials(email, password);
    if (!result) {
      recordFailure(key);
      return json({ error: "Credenciales inválidas" }, 401);
    }
    recordSuccess(key);
    await createSession({
      userId: result.user.id,
      tenantId: result.membership.tenantId,
      role: result.membership.role,
      name: result.user.name,
    });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
