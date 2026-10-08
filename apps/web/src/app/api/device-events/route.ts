import { json, withAuth } from "@/lib/api";
import { visibleDeviceIds } from "@/server/access";
import { recentDeviceEvents } from "@/server/events";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, { session }) =>
  json(await recentDeviceEvents(session.tenantId, await visibleDeviceIds(session))),
);
