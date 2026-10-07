import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { getPipeline } from "@/lib/ingest";
import { deleteDevice, updateDeviceWithUnit } from "@/server/fleet";
import { deviceUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>(
  async (req, { session, params }) => {
    const { id } = await params;
    const input = await parseBody(req, deviceUpdateSchema);
    const row = await updateDeviceWithUnit(session.tenantId, id, input);
    if (!row) throw new HttpError(404, "Dispositivo no encontrado");
    return json({ ok: true });
  },
  { manage: true },
);

export const DELETE = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    const removed = await deleteDevice(session.tenantId, id);
    if (!removed) throw new HttpError(404, "Dispositivo no encontrado");
    if (process.env.DATABASE_URL) getPipeline().invalidate(removed.imei);
    return json({ ok: true });
  },
  { manage: true },
);
