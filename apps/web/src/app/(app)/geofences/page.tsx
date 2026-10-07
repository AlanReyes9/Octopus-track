import { GeofenceEditor } from "@/components/map/geofence-editor";
import { canManage, getSession } from "@/lib/auth";

export default async function GeofencesPage() {
  const session = (await getSession())!;
  return <GeofenceEditor canManage={canManage(session.role)} />;
}
