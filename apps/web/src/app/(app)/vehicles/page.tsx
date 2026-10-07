import { PageHeader } from "@/components/app/page-header";
import { VehiclesManager } from "@/components/app/vehicles-manager";
import { canManage, getSession } from "@/lib/auth";
import { listDevices, listVehicles } from "@/server/fleet";

export default async function VehiclesPage() {
  const session = (await getSession())!;
  const [vehicles, devices] = await Promise.all([listVehicles(session.tenantId), listDevices(session.tenantId)]);
  return (
    <>
      <PageHeader title="Vehículos" description="Unidades de la flota y el dispositivo GPS asignado a cada una." />
      <VehiclesManager
        initial={JSON.parse(JSON.stringify(vehicles))}
        devices={devices.map((d) => ({ id: d.id, name: d.name, imei: d.imei, vehicleId: d.vehicleId }))}
        canManage={canManage(session.role)}
      />
    </>
  );
}
