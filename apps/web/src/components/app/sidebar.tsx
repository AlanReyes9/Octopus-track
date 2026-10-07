"use client";

import {
  Car,
  ChevronsUpDown,
  Network,
  Cpu,
  History,
  LayoutDashboard,
  LogOut,
  Shapes,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { OctopusLogo } from "@/components/brand/octopus-logo";
import { cn } from "@/lib/utils";

type Role = "owner" | "admin" | "viewer";

const NAV: { href: string; label: string; icon: typeof Car; manage?: boolean }[] = [
  { href: "/dashboard", label: "Mapa en vivo", icon: LayoutDashboard },
  { href: "/history", label: "Historial", icon: History },
  { href: "/geofences", label: "Geocercas", icon: Shapes },
  { href: "/devices", label: "Dispositivos", icon: Cpu, manage: true },
  { href: "/users", label: "Usuarios", icon: Users, manage: true },
  { href: "/protocols", label: "Protocolos", icon: Network, manage: true },
];

const ROLE_LABEL: Record<Role, string> = { owner: "Propietario", admin: "Administrador", viewer: "Cliente" };

export function AppSidebar(props: {
  userName: string;
  email: string;
  role: Role;
  tenants: { id: string; name: string }[];
  activeTenantId: string;
  mustChangePassword: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const manage = props.role !== "viewer";

  // Contraseña temporal: obliga a cambiarla antes de usar el panel.
  useEffect(() => {
    if (props.mustChangePassword && pathname !== "/account") router.replace("/account?force=1");
  }, [props.mustChangePassword, pathname, router]);

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

  const initials = props.userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="relative flex shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground md:w-64">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-violet-500/25 to-transparent" />
      <div className="relative flex items-center justify-between px-5 py-5">
        <Link href="/dashboard">
          <OctopusLogo inverted />
        </Link>
      </div>

      <div className="relative px-3 pb-3">
        <div className="relative">
          {props.tenants.length > 1 ? (
            <>
              <select
                className="w-full appearance-none rounded-lg border border-white/10 bg-white/10 py-2 pr-8 pl-3 text-sm font-medium"
                value={props.activeTenantId}
                onChange={(e) => switchTenant(e.target.value)}
              >
                {props.tenants.map((t) => (
                  <option key={t.id} value={t.id} className="text-black">
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronsUpDown className="pointer-events-none absolute top-2.5 right-2.5 size-4 opacity-60" />
            </>
          ) : (
            <div className="truncate rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium">
              {props.tenants[0]?.name}
            </div>
          )}
        </div>
      </div>

      <nav className="relative flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col">
        <p className="hidden px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-violet-200/60 uppercase md:block">
          Monitoreo
        </p>
        {NAV.filter((n) => !n.manage).map((n) => (
          <NavLink key={n.href} {...n} active={pathname.startsWith(n.href)} />
        ))}
        {manage && (
          <>
            <p className="hidden px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-violet-200/60 uppercase md:block">
              Administración
            </p>
            {NAV.filter((n) => n.manage).map((n) => (
              <NavLink key={n.href} {...n} active={pathname.startsWith(n.href)} />
            ))}
          </>
        )}
        <div className="md:hidden">
          <NavLink href="/account" label="Mi cuenta" icon={UserCog} active={pathname.startsWith("/account")} />
        </div>
      </nav>

      <div className="relative hidden border-t border-white/10 p-3 md:block">
        <Link
          href="/account"
          className={cn(
            "flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/10",
            pathname.startsWith("/account") && "bg-white/10",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-400/30 text-sm font-semibold">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{props.userName}</span>
            <span className="block truncate text-xs text-violet-200/70">{ROLE_LABEL[props.role]}</span>
          </span>
        </Link>
        <button
          onClick={logout}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-violet-100/80 hover:bg-white/10"
        >
          <LogOut className="size-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Car; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-violet-100/85 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-white text-violet-800 shadow-sm hover:bg-white hover:text-violet-800",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
