import { z } from "zod";
import { getCommand } from "@octopus/telemetry";
import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { createRule, listRules } from "@/server/rules";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  trigger: z.enum(["enter", "exit", "both"]),
  deviceId: z.uuid().nullable().default(null),
  action: z.enum(["notify", "command"]),
  commandType: z.string().max(40).nullable().default(null),
  params: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).default({}),
});

export const GET = withAuth<Ctx>(
  async (_req, { session, params }) => json(await listRules(session.tenantId, (await params).id)),
  { manage: true },
);

export const POST = withAuth<Ctx>(
  async (req, { session, params }) => {
    const input = await parseBody(req, schema);
    if (input.action === "command") {
      if (!input.commandType || !getCommand(input.commandType)) throw new HttpError(400, "Comando no válido");
      if (input.commandType === "engineStop") {
        throw new HttpError(400, "Por seguridad, el bloqueo de motor no puede ejecutarse automáticamente desde una geocerca");
      }
    }
    return json(await createRule(session.tenantId, session.userId, (await params).id, input), 201);
  },
  { manage: true },
);
