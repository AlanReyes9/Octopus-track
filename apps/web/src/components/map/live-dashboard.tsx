"use client";

import type { Marker, Popup } from "maplibre-gl";
import { Bell, Gauge, Power, Radio, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLivePositions } from "@/hooks/use-live-positions";
import { api } from "@/lib/fetcher";
import { cn, formatDateTime, isOnline, timeAgo } from "@/lib/utils";
import type { LivePosition } from "@/server/positions";
import { createVehicleMarkerElement, setMarkerCourse } from "./vehicle-marker";
import { syncGeofenceLayer, useMap, type GeofenceFeature } from "./use-map";

function popupHtml(p: LivePosition) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `
    <div style="min-width:180px">
      <div style="font-weight:600">${esc(p.vehicleName ?? p.deviceName)}</div>
      ${p.plate ? `<div style="opacity:.7">${esc(p.plate)}</div>` : ""}
      <div style="margin-top:4px">${(p.speedKmh ?? 0).toFixed(0)} km/h · ${p.ignition ? "Encendido" : "Apagado"}</div>
      <div style="opacity:.7">${formatDateTime(p.time)}</div>
      <div style="opacity:.7;font-family:monospace">${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}</div>
    </div>`;
}

export function LiveDashboard() {
  const { containerRef, map, lib } = useMap();
  const { positions, alerts, mode, loaded } = useLivePositions();
  const markers = useRef(new Map<string, { marker: Marker; popup: Popup; el: HTMLDivElement }>());
  const fitted = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [, setTick] = useState(0);

  // Refresca los "hace X" cada 15 s.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Geocercas como capa de contexto.
  useEffect(() => {
    if (!map) return;
    api<GeofenceFeature[]>("/api/geofences")
      .then((g) => syncGeofenceLayer(map, g))
      .catch(() => {});
  }, [map]);

  // Sincroniza marcadores con las posiciones.
  useEffect(() => {
    if (!map || !lib) return;
    const seen = new Set<string>();
    for (const p of positions) {
      seen.add(p.deviceId);
      const existing = markers.current.get(p.deviceId);
      if (existing) {
        existing.marker.setLngLat([p.longitude, p.latitude]);
        existing.popup.setHTML(popupHtml(p));
        setMarkerCourse(existing.el, p.course);
      } else {
        const el = createVehicleMarkerElement(p.color);
        setMarkerCourse(el, p.course);
        const popup = new lib.Popup({ offset: 16, closeButton: false }).setHTML(popupHtml(p));
        const marker = new lib.Marker({ element: el }).setLngLat([p.longitude, p.latitude]).setPopup(popup).addTo(map);
        el.addEventListener("click", () => setSelected(p.deviceId));
        markers.current.set(p.deviceId, { marker, popup, el });
      }
    }
    for (const [id, m] of markers.current) {
      if (!seen.has(id)) {
        m.marker.remove();
        markers.current.delete(id);
      }
    }
    if (!fitted.current && positions.length) {
      fitted.current = true;
      const bounds = new lib.LngLatBounds();
      positions.forEach((p) => bounds.extend([p.longitude, p.latitude]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 0 });
    }
  }, [positions, map, lib]);

  // Seguir al vehículo seleccionado.
  const selectedPos = positions.find((p) => p.deviceId === selected);
  useEffect(() => {
    if (!map || !selectedPos) return;
    map.easeTo({ center: [selectedPos.longitude, selectedPos.latitude], duration: 600 });
  }, [map, selectedPos?.latitude, selectedPos?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return positions.filter((p) =>
      [p.vehicleName, p.deviceName, p.plate, p.imei].some((s) => s?.toLowerCase().includes(q)),
    );
  }, [positions, query]);

  const online = positions.filter((p) => isOnline(p.time)).length;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <section className="flex max-h-[45svh] flex-col border-b lg:max-h-none lg:w-80 lg:border-r lg:border-b-0">
        <div className="space-y-3 border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold">Flota</h1>
            <Badge variant={mode === "websocket" ? "success" : "secondary"} title="Canal de actualización">
              <Radio className="size-3" />
              {mode === "websocket" ? "En vivo" : mode === "polling" ? "Polling 10 s" : "Conectando"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Unidades" value={positions.length} />
            <Stat label="En línea" value={online} className="text-emerald-600" />
            <Stat label="Sin señal" value={positions.length - online} className="text-muted-foreground" />
          </div>
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Buscar unidad, placa o IMEI" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <ul className="flex-1 overflow-auto">
          {loaded && filtered.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">
              Sin posiciones todavía. Registra un dispositivo y envía telemetría a la ingesta.
            </li>
          )}
          {filtered.map((p) => (
            <li key={p.deviceId}>
              <button
                onClick={() => {
                  setSelected(p.deviceId);
                  markers.current.get(p.deviceId)?.marker.togglePopup();
                }}
                className={cn(
                  "flex w-full items-start gap-3 border-b px-4 py-3 text-left hover:bg-muted/60",
                  selected === p.deviceId && "bg-muted",
                )}
              >
                <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{p.vehicleName ?? p.deviceName}</span>
                    <span className={cn("size-2 rounded-full", isOnline(p.time) ? "bg-emerald-500" : "bg-zinc-400")} />
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Gauge className="size-3" />
                      {(p.speedKmh ?? 0).toFixed(0)} km/h
                    </span>
                    <span className="flex items-center gap-1">
                      <Power className={cn("size-3", p.ignition && "text-emerald-600")} />
                      {p.ignition === null ? "—" : p.ignition ? "On" : "Off"}
                    </span>
                    <span>{timeAgo(p.time)}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {alerts.length > 0 && (
          <div className="max-h-48 overflow-auto border-t p-3">
            <div className="mb-2 flex items-center gap-1 text-xs font-medium">
              <Bell className="size-3" /> Alertas de geocerca
            </div>
            <ul className="space-y-1 text-xs">
              {alerts.map((a) => {
                const unit = positions.find((p) => p.deviceId === a.deviceId);
                return (
                  <li key={`${a.deviceId}-${a.geofenceId}-${a.time}-${a.event}`}>
                    <Badge variant={a.event === "enter" ? "success" : "warning"}>
                      {a.event === "enter" ? "Entrada" : "Salida"}
                    </Badge>{" "}
                    {unit?.vehicleName ?? unit?.deviceName ?? "Unidad"} · {a.geofenceName} ·{" "}
                    <span className="text-muted-foreground">{timeAgo(a.time)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
      <div ref={containerRef} className="min-h-[55svh] flex-1" />
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-md bg-muted px-2 py-1.5">
      <div className={cn("text-lg font-semibold", className)}>{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
