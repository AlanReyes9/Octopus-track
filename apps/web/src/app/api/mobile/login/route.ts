import { z } from "zod";
import { errorResponse, json, parseBody } from "@/lib/api";
import { clientIp, lockedFor, loginKey, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { verifyCredentials } from "@/server/auth";
import { issueMobileToken, mobileProfile } from "@/server/mobile";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  tenantId: z.uuid().optional(),
});

/** Inicio de sesión de la app móvil: devuelve un token Bearer (30 días). */
export async function POST(req: Request) {
  try {
    const { email, password, tenantId } = await parseBody(req, schema);
    const key = loginKey(email, clientIp(req));
    if (lockedFor(key)) return json({ error: "Demasiados intentos. Espera unos minutos." }, 429);
    const result = await verifyCredentials(email, password, tenantId);
    if (!result) {
      recordFailure(key);
      return json({ error: "Correo o contraseña incorrectos" }, 401);
    }
    recordSuccess(key);
    const session = {
      userId: result.user.id,
      tenantId: result.membership.tenantId,
      role: result.membership.role,
      name: result.user.name,
    };
    const { token, expiresAt } = await issueMobileToken(session);
    return json({ token, expiresAt: expiresAt.toISOString(), ...(await mobileProfile(session)) });
  } catch (err) {
    return errorResponse(err);
  }
}
