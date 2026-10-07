import { HistoryViewer } from "@/components/map/history-viewer";
import { getSession } from "@/lib/auth";
import { listDevices } from "@/server/fleet";

export default async function HistoryPage() {
  const session = (await getSession())!;
  const devices = await listDevices(session.tenantId);
  return (
    <HistoryViewer
      devices={devices.map((d) => ({ id: d.id, label: d.vehicleName ? `${d.vehicleName} · ${d.name}` : d.name }))}
    />
  );
}
