import { z } from "zod";
import { isValidLatitude, isValidLongitude } from "@octopus/telemetry";
import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { createGeofence, listGeofences } from "@/server/geofences";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f97316"),
  ring: z
    .array(z.tuple([z.number(), z.number()]))
    .min(3)
    .max(500)
    .refine((r) => r.every(([lng, lat]) => isValidLongitude(lng) && isValidLatitude(lat)), "Coordenadas inválidas"),
});

export const GET = withAuth(async (_req, { session }) => json(await listGeofences(session.tenantId)));

export const POST = withAuth(
  async (req, { session }) => {
    const input = await parseBody(req, schema);
    const id = await createGeofence(session.tenantId, input);
    if (!id) throw new HttpError(422, "El polígono no es válido (¿se cruzan sus lados?)");
    return json({ id }, 201);
  },
  { manage: true },
);
