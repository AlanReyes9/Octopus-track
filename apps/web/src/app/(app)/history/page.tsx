import type { Metadata } from "next";
import { HistoryViewer } from "@/components/map/history-viewer";
import { requireSession } from "@/lib/guards";
import { visibleDeviceIds } from "@/server/access";
import { listDevices } from "@/server/fleet";

export const metadata: Metadata = { title: "Historial" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const session = await requireSession();
  const devices = await listDevices(session.tenantId, await visibleDeviceIds(session));
  const { device } = await searchParams;
  return (
    <HistoryViewer
      initialDeviceId={devices.some((d) => d.id === device) ? device : undefined}
      devices={devices.map((d) => ({
        id: d.id,
        label: d.plate ? `${d.vehicleName ?? d.name} · ${d.plate}` : (d.vehicleName ?? d.name),
        icon: d.icon ?? (d.kind === "phone" ? "person" : "car"),
        color: d.color ?? "#7c3aed",
      }))}
    />
  );
}
