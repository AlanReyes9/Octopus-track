import type { Metadata } from "next";
import { LiveDashboard } from "@/components/map/live-dashboard";
import { canManage } from "@/lib/auth";
import { requireSession } from "@/lib/guards";

export const metadata: Metadata = { title: "Mapa en vivo" };

export default async function DashboardPage() {
  const session = await requireSession();
  return <LiveDashboard canManage={canManage(session.role)} />;
}
