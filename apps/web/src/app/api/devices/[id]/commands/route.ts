import { json, parseBody, withAuth } from "@/lib/api";
import { commandSchema } from "@/lib/schemas";
import { enqueueCommand, listCommands } from "@/server/commands";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    return json(await listCommands(session.tenantId, id));
  },
  { manage: true },
);

export const POST = withAuth<Ctx>(
  async (req, { session, params }) => {
    const { id } = await params;
    const { type, params: cmdParams } = await parseBody(req, commandSchema);
    return json(await enqueueCommand(session, id, type, cmdParams), 201);
  },
  { manage: true },
);
