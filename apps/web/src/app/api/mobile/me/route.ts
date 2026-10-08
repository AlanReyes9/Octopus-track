import { json, withAuth } from "@/lib/api";
import { mobileProfile } from "@/server/mobile";

export const dynamic = "force-dynamic";

/** Perfil de la sesión actual (la app lo consulta al abrir para validar el token). */
export const GET = withAuth(async (_req, { session }) => json(await mobileProfile(session)));
