import { GeofenceEditor } from "@/components/map/geofence-editor";
import { canManage } from "@/lib/auth";
import { requireSession } from "@/lib/guards";

export default async function GeofencesPage() {
  const session = await requireSession();
  return <GeofenceEditor canManage={canManage(session.role)} />;
}
