import { json, parseBody, withAuth } from "@/lib/api";
import { commandSchema } from "@/lib/schemas";
import { enqueueCommand, listCommands } from "@/server/commands";

type Ctx = { params: Promise<{ id: string }> };

// Enviar comandos ya no requiere rol de gestión: cualquier persona con acceso al
// tenant (incluidos los clientes/viewer) puede operar los equipos que ve.
export const GET = withAuth<Ctx>(async (_req, { session, params }) => {
  const { id } = await params;
  return json(await listCommands(session.tenantId, id));
});

export const POST = withAuth<Ctx>(async (req, { session, params }) => {
  const { id } = await params;
  const { type, params: cmdParams } = await parseBody(req, commandSchema);
  return json(await enqueueCommand(session, id, type, cmdParams), 201);
});
