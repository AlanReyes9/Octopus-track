import { z } from "zod";
import { HttpError, json, withAuth } from "@/lib/api";
import { assertDeviceVisible } from "@/server/access";
import { deviceHistory } from "@/server/positions";

const schema = z.object({
  deviceId: z.uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

const MAX_RANGE_MS = 31 * 24 * 3600 * 1000;

export const GET = withAuth(async (req, { session }) => {
  const q = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  if (q.to <= q.from) throw new HttpError(400, "El rango de fechas es inválido");
  if (q.to.getTime() - q.from.getTime() > MAX_RANGE_MS) throw new HttpError(400, "Rango máximo: 31 días");
  await assertDeviceVisible(session, q.deviceId);
  return json(await deviceHistory(session.tenantId, q.deviceId, q.from, q.to));
});
