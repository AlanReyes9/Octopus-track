import type { Metadata } from "next";
import { LiveDashboard } from "@/components/map/live-dashboard";
import { requireSession } from "@/lib/guards";

export const metadata: Metadata = { title: "Mapa en vivo" };

export default async function DashboardPage() {
  await requireSession();
  return <LiveDashboard />;
}
