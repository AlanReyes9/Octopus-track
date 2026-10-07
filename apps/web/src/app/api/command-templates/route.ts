import { z } from "zod";
import { getCommand } from "@octopus/telemetry";
import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { createTemplate, listTemplates } from "@/server/templates";

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  protocol: z.string().max(40).nullish(),
  type: z.string().min(1).max(40),
  params: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).default({}),
});

export const GET = withAuth(async (_req, { session }) => json(await listTemplates(session.tenantId)), { manage: true });

export const POST = withAuth(
  async (req, { session }) => {
    const input = await parseBody(req, schema);
    if (!getCommand(input.type)) throw new HttpError(400, "Tipo de comando desconocido");
    return json(await createTemplate(session.tenantId, session.userId, { ...input, protocol: input.protocol ?? null }), 201);
  },
  { manage: true },
);
