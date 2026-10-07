import { json, withAuth } from "@/lib/api";
import { latestPositions } from "@/server/positions";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, { session }) => json(await latestPositions(session.tenantId)));
