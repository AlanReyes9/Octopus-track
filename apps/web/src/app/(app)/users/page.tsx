import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { UsersManager } from "@/components/app/users-manager";
import { requireManager } from "@/lib/guards";
import { listVehicles } from "@/server/fleet";
import { listTenantUsers } from "@/server/users";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const session = await requireManager();
  const [users, vehicles] = await Promise.all([listTenantUsers(session.tenantId), listVehicles(session.tenantId)]);
  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Crea cuentas para tu equipo y para tus clientes. Los clientes solo ven las unidades que les asignes y no pueden registrar equipos ni enviar comandos."
      />
      <UsersManager
        users={users}
        vehicles={vehicles.map((v) => ({ id: v.id, name: v.name, plate: v.plate }))}
        currentUserId={session.userId}
        isOwner={session.role === "owner"}
      />
    </>
  );
}
