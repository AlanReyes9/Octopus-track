import type { Metadata } from "next";
import { EventsList } from "@/components/app/events-list";
import { requireSession } from "@/lib/guards";

export const metadata: Metadata = { title: "Eventos" };

export default async function EventsPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <h1 className="mb-1 text-lg font-bold tracking-tight">Eventos</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Cambios de estado de tus equipos: encendido o apagado del motor, conexión y batería baja.
      </p>
      <EventsList />
    </div>
  );
}
