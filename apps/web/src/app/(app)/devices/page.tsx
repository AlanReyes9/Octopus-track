import type { Metadata } from "next";
import { DevicesManager } from "@/components/app/devices-manager";
import { PageHeader } from "@/components/app/page-header";
import { requireManager } from "@/lib/guards";
import { listDevices } from "@/server/fleet";

export const metadata: Metadata = { title: "Dispositivos" };

export default async function DevicesPage() {
  const session = await requireManager();
  const devices = await listDevices(session.tenantId);
  return (
    <>
      <PageHeader
        title="Dispositivos"
        description="Rastreadores GPS (identificados por IMEI) y teléfonos Android/iOS vinculados con consentimiento."
      />
      <DevicesManager initial={JSON.parse(JSON.stringify(devices))} />
    </>
  );
}
