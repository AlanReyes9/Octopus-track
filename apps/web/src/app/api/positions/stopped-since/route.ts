import { z } from "zod";
import { json, withAuth } from "@/lib/api";
import { assertDeviceVisible } from "@/server/access";
import { deviceStoppedSince } from "@/server/positions";

const schema = z.object({ deviceId: z.uuid() });

export const GET = withAuth(async (req, { session }) => {
  const q = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  await assertDeviceVisible(session, q.deviceId);
  return json(await deviceStoppedSince(session.tenantId, q.deviceId));
});
