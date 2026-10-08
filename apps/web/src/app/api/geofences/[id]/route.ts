import { z } from "zod";
import { isValidLatitude, isValidLongitude } from "@octopus/telemetry";
import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { deleteGeofence, updateGeofence } from "@/server/geofences";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ring: z
    .array(z.tuple([z.number(), z.number()]))
    .min(3)
    .max(500)
    .refine((r) => r.every(([lng, lat]) => isValidLongitude(lng) && isValidLatitude(lat)), "Coordenadas inválidas")
    .optional(),
});

export const PATCH = withAuth<Ctx>(
  async (req, { session, params }) => {
    const { id } = await params;
    const input = await parseBody(req, schema);
    if (!(await updateGeofence(session.tenantId, id, input))) {
      throw new HttpError(422, "No se pudo actualizar (¿geocerca inexistente o polígono inválido?)");
    }
    return json({ ok: true });
  },
  { manage: true },
);

export const DELETE = withAuth<Ctx>(
  async (_req, { session, params }) => {
    const { id } = await params;
    if (!(await deleteGeofence(session.tenantId, id))) throw new HttpError(404, "Geocerca no encontrada");
    return json({ ok: true });
  },
  { manage: true },
);
