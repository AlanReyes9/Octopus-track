import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { deleteVehicle, updateVehicle } from "@/server/fleet";
import { vehicleSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>(
  async (req, { session, params }) => {
    const { id } = await params;
    const input = await parseBody(req, vehicleSchema.partial());
    const row = await updateVehicle(session.tenantId, id, input);
    if (!row) throw new HttpError(404, "Vehículo no encontrado");
    return json(row);
  },
  { manage: true },
);

export const DELETE = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    if (!(await deleteVehicle(session.tenantId, id))) throw new HttpError(404, "Vehículo no encontrado");
    return json({ ok: true });
  },
  { manage: true },
);
