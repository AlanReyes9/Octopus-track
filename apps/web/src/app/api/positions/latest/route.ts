import { json, withAuth } from "@/lib/api";
import { visibleDeviceIds } from "@/server/access";
import { latestPositions } from "@/server/positions";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, { session }) =>
  json(await latestPositions(session.tenantId, await visibleDeviceIds(session))),
);
