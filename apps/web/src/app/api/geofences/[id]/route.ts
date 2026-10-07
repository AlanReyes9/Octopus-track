import { HttpError, json, withAuth } from "@/lib/api";
import { deleteGeofence } from "@/server/geofences";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    if (!(await deleteGeofence(session.tenantId, id))) throw new HttpError(404, "Geocerca no encontrada");
    return json({ ok: true });
  },
  { manage: true },
);
