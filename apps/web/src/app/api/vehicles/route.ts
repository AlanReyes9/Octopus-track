import { json, parseBody, withAuth } from "@/lib/api";
import { vehicleSchema } from "@/lib/schemas";
import { createVehicle, listVehicles } from "@/server/fleet";

export const GET = withAuth(async (_req, { session }) => json(await listVehicles(session.tenantId)));

export const POST = withAuth(
  async (req, { session }) => {
    const input = await parseBody(req, vehicleSchema);
    return json(await createVehicle(session.tenantId, input), 201);
  },
  { manage: true },
);
