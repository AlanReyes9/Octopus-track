import { json, parseBody, withAuth } from "@/lib/api";
import { deviceSchema } from "@/lib/schemas";
import { createDevice, listDevices } from "@/server/fleet";

export const GET = withAuth(async (_req, { session }) => json(await listDevices(session.tenantId)));

export const POST = withAuth(
  async (req, { session }) => {
    const input = await parseBody(req, deviceSchema);
    return json(await createDevice(session.tenantId, input), 201);
  },
  { manage: true },
);
