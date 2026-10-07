import { redirect } from "next/navigation";
import { isDbConfigured } from "@octopus/db";
import { AppSidebar } from "@/components/app/sidebar";
import { getSession } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { listUserTenants } from "@/server/auth";
import { getUserFlags } from "@/server/users";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (missingEnv().length || !isDbConfigured()) redirect("/setup");
  const session = await getSession();
  if (!session) redirect("/login");
  const [tenants, flags] = await Promise.all([listUserTenants(session.userId), getUserFlags(session.userId)]);
  if (!flags || !tenants.some((t) => t.id === session.tenantId)) redirect("/login");

  return (
    <div className="flex h-svh flex-col bg-muted/30 md:flex-row">
      <AppSidebar
        userName={flags.name}
        email={flags.email}
        role={session.role}
        tenants={tenants}
        activeTenantId={session.tenantId}
        mustChangePassword={flags.mustChangePassword}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
