"use client";

import { BatteryWarning, Power, PowerOff, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/fetcher";
import { cn, timeAgo } from "@/lib/utils";

interface DeviceEvent {
  time: string;
  type: "ignition_on" | "ignition_off" | "offline" | "online" | "low_battery";
  message: string;
  deviceId: string;
  unit: string;
}

const META: Record<DeviceEvent["type"], { icon: typeof Power; label: string; variant: "success" | "warning" | "destructive" }> = {
  ignition_on: { icon: Power, label: "Motor encendido", variant: "success" },
  ignition_off: { icon: PowerOff, label: "Motor apagado", variant: "warning" },
  online: { icon: Wifi, label: "Conectado", variant: "success" },
  offline: { icon: WifiOff, label: "Sin conexión", variant: "destructive" },
  low_battery: { icon: BatteryWarning, label: "Batería baja", variant: "warning" },
};

export function EventsList() {
  const [events, setEvents] = useState<DeviceEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api<DeviceEvent[]>("/api/device-events")
        .then((r) => !cancelled && setEvents(r))
        .catch((err) => !cancelled && setError(err.message));
    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!events) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin eventos todavía. Aquí aparecerán los cambios de estado de tus equipos: encendido/apagado del motor,
        conexión/desconexión y batería baja.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((e, i) => {
        const meta = META[e.type];
        const Icon = meta.icon;
        return (
          <li key={i} className="flex items-center gap-3 rounded-lg border bg-white p-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                meta.variant === "success" && "bg-emerald-100 text-emerald-600",
                meta.variant === "warning" && "bg-amber-100 text-amber-600",
                meta.variant === "destructive" && "bg-red-100 text-red-600",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{e.unit}</p>
              <p className="truncate text-xs text-muted-foreground">{e.message}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant={meta.variant}>{meta.label}</Badge>
              <span className="text-xs text-muted-foreground">{timeAgo(e.time)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
