import { json, parseBody, withAuth } from "@/lib/api";
import { vehicleSchema } from "@/lib/schemas";
import { visibleVehicleIds } from "@/server/access";
import { createVehicle, listVehicles } from "@/server/fleet";

export const GET = withAuth(async (_req, { session }) =>
  json(await listVehicles(session.tenantId, await visibleVehicleIds(session))),
);

export const POST = withAuth(
  async (req, { session }) => {
    const input = await parseBody(req, vehicleSchema);
    return json(await createVehicle(session.tenantId, input), 201);
  },
  { manage: true },
);
