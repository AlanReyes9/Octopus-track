import { DevicesManager } from "@/components/app/devices-manager";
import { PageHeader } from "@/components/app/page-header";
import { canManage, getSession } from "@/lib/auth";
import { listDevices } from "@/server/fleet";

export default async function DevicesPage() {
  const session = (await getSession())!;
  const devices = await listDevices(session.tenantId);
  return (
    <>
      <PageHeader
        title="Dispositivos"
        description="Equipos GPS identificados por IMEI. El IMEI enruta cada trama de telemetría a tu empresa."
      />
      <DevicesManager initial={JSON.parse(JSON.stringify(devices))} canManage={canManage(session.role)} />
    </>
  );
}
