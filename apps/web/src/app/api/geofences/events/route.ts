import { json, withAuth } from "@/lib/api";
import { recentGeofenceEvents } from "@/server/geofences";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, { session }) => json(await recentGeofenceEvents(session.tenantId)));
