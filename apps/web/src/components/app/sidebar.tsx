"use client";

import { Car, Cpu, History, LayoutDashboard, LogOut, Radar, Shapes } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Mapa en vivo", icon: LayoutDashboard },
  { href: "/history", label: "Historial", icon: History },
  { href: "/geofences", label: "Geocercas", icon: Shapes },
  { href: "/vehicles", label: "Vehículos", icon: Car },
  { href: "/devices", label: "Dispositivos", icon: Cpu },
];

const ROLE_LABEL = { owner: "Propietario", admin: "Administrador", viewer: "Lectura" } as const;

export function AppSidebar(props: {
  userName: string;
  role: keyof typeof ROLE_LABEL;
  tenants: { id: string; name: string }[];
  activeTenantId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function switchTenant(tenantId: string) {
    await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    router.refresh();
  }

  return (
    <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground md:w-60">
      <div className="flex items-center gap-2 px-4 py-4 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary">
          <Radar className="size-5" />
        </span>
        Octopus Track
      </div>

      <div className="px-3 pb-3">
        {props.tenants.length > 1 ? (
          <select
            className="w-full rounded-md bg-white/10 px-2 py-1.5 text-sm"
            value={props.activeTenantId}
            onChange={(e) => switchTenant(e.target.value)}
          >
            {props.tenants.map((t) => (
              <option key={t.id} value={t.id} className="text-black">
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="truncate rounded-md bg-white/10 px-2 py-1.5 text-sm">{props.tenants[0]?.name}</div>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 md:flex-1 md:flex-col">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors hover:bg-white/10",
              pathname.startsWith(href) && "bg-white/15 font-medium",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="hidden items-center justify-between gap-2 border-t border-white/10 p-3 md:flex">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{props.userName}</div>
          <div className="text-xs opacity-60">{ROLE_LABEL[props.role]}</div>
        </div>
        <button onClick={logout} className="rounded-md p-2 hover:bg-white/10" title="Cerrar sesión">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}
