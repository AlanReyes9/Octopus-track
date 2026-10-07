"use client";

import type { GeoJSONSource, Marker } from "maplibre-gl";
import type { Feature } from "geojson";
import {
  Battery,
  Bell,
  Clock,
  Crosshair,
  ExternalLink,
  Gauge,
  History,
  Navigation,
  Power,
  Radio,
  Search,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CommandsDialog } from "@/components/app/commands-dialog";
import { VehicleIcon } from "@/components/brand/vehicle-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLivePositions } from "@/hooks/use-live-positions";
import { api } from "@/lib/fetcher";
import { googleMapsDirections, googleMapsPlace } from "@/lib/maps-links";
import { cn, formatDateTime, isOnline, timeAgo } from "@/lib/utils";
import type { LivePosition } from "@/server/positions";
import { syncGeofenceLayer, useMap, type GeofenceFeature } from "./use-map";
import { createVehicleMarkerElement, setMarkerCourse } from "./vehicle-marker";

const TRAIL_POINTS = 120;

export function LiveDashboard({ canManage }: { canManage: boolean }) {
  const { containerRef, map, lib } = useMap();
  const { positions, alerts, mode, loaded } = useLivePositions();
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
  const trails = useRef(new Map<string, [number, number][]>());
  const fitted = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Geocercas de contexto + capa de estela del seleccionado.
  useEffect(() => {
    if (!map) return;
    api<GeofenceFeature[]>("/api/geofences")
      .then((g) => syncGeofenceLayer(map, g))
      .catch(() => {});
    map.addSource("trail", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "trail",
      type: "line",
      source: "trail",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#7c3aed", "line-width": 4, "line-opacity": 0.75 },
    });
    // Si el usuario mueve el mapa manualmente, se desactiva el seguimiento.
    const stop = () => setFollow(false);
    map.on("dragstart", stop);
    return () => {
      map.off("dragstart", stop);
    };
  }, [map]);

  // Marcadores y estelas.
  useEffect(() => {
    if (!map || !lib) return;
    const seen = new Set<string>();
    for (const p of positions) {
      seen.add(p.deviceId);
      const trail = trails.current.get(p.deviceId) ?? [];
      const last = trail.at(-1);
      if (!last || last[0] !== p.longitude || last[1] !== p.latitude) {
        trail.push([p.longitude, p.latitude]);
        if (trail.length > TRAIL_POINTS) trail.shift();
        trails.current.set(p.deviceId, trail);
      }
      const existing = markers.current.get(p.deviceId);
      if (existing) {
        existing.marker.setLngLat([p.longitude, p.latitude]);
        setMarkerCourse(existing.el, p.course);
      } else {
        const el = createVehicleMarkerElement(p.color, p.icon);
        setMarkerCourse(el, p.course);
        el.title = p.vehicleName ?? p.deviceName;
        el.addEventListener("click", () => {
          setSelected(p.deviceId);
          setFollow(true);
        });
        const marker = new lib.Marker({ element: el }).setLngLat([p.longitude, p.latitude]).addTo(map);
        markers.current.set(p.deviceId, { marker, el });
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

  const current = positions.find((p) => p.deviceId === selected) ?? null;

  // Resaltado, estela y seguimiento del seleccionado.
  useEffect(() => {
    if (!map) return;
    for (const [id, m] of markers.current) m.el.style.zIndex = id === selected ? "10" : "";
    const coords = selected ? trails.current.get(selected) ?? [] : [];
    const data: Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
    (map.getSource("trail") as GeoJSONSource | undefined)?.setData(data);
    if (current && follow) {
      map.easeTo({ center: [current.longitude, current.latitude], zoom: Math.max(map.getZoom(), 15), duration: 800 });
    }
  }, [map, selected, follow, current?.latitude, current?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return positions.filter((p) => [p.vehicleName, p.deviceName, p.plate, p.imei].some((s) => s?.toLowerCase().includes(q)));
  }, [positions, query]);

  const online = positions.filter((p) => isOnline(p.time)).length;
  const moving = positions.filter((p) => isOnline(p.time) && (p.speedKmh ?? 0) > 3).length;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Lista de unidades */}
      <section className="flex max-h-[45svh] flex-col border-b bg-white lg:max-h-none lg:w-[340px] lg:border-r lg:border-b-0">
        <div className="space-y-4 border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight">Mapa en vivo</h1>
            <Badge variant={mode === "websocket" ? "success" : "secondary"} title="Canal de actualización">
              <Radio className="size-3" />
              {mode === "websocket" ? "Tiempo real" : mode === "polling" ? "Cada 10 s" : "Conectando"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Unidades" value={positions.length} />
            <Stat label="En línea" value={online} accent="text-emerald-600" />
            <Stat label="En marcha" value={moving} accent="text-violet-600" />
          </div>
          <div className="relative">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input placeholder="Buscar unidad, placa o IMEI" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <ul className="flex-1 overflow-auto p-2">
          {loaded && filtered.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">
              {positions.length === 0 ? "Aún no hay posiciones. Registra un dispositivo o vincula un teléfono." : "Sin resultados."}
            </li>
          )}
          {filtered.map((p) => {
            const on = isOnline(p.time);
            return (
              <li key={p.deviceId}>
                <button
                  onClick={() => {
                    setSelected(p.deviceId);
                    setFollow(true);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-violet-50",
                    selected === p.deviceId && "bg-violet-50 ring-1 ring-violet-200",
                  )}
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: p.color }}>
                    <VehicleIcon icon={p.icon} className="size-5" />
                    <span className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white", on ? "bg-emerald-500" : "bg-zinc-400")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.vehicleName ?? p.deviceName}</span>
                    <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Gauge className="size-3" />
                        {(p.speedKmh ?? 0).toFixed(0)} km/h
                      </span>
                      {p.kind === "gps" && (
                        <span className="flex items-center gap-1">
                          <Power className={cn("size-3", p.ignition && "text-emerald-600")} />
                          {p.ignition === null ? "—" : p.ignition ? "On" : "Off"}
                        </span>
                      )}
                      <span>{timeAgo(p.time)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {alerts.length > 0 && (
          <div className="max-h-44 overflow-auto border-t p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Bell className="size-3.5 text-violet-600" /> Alertas de geocerca
            </div>
            <ul className="space-y-1.5 text-xs">
              {alerts.map((a) => {
                const unit = positions.find((p) => p.deviceId === a.deviceId);
                return (
                  <li key={`${a.deviceId}-${a.geofenceId}-${a.time}-${a.event}`} className="flex flex-wrap items-center gap-1">
                    <Badge variant={a.event === "enter" ? "success" : "warning"}>{a.event === "enter" ? "Entrada" : "Salida"}</Badge>
                    <span className="font-medium">{unit?.vehicleName ?? unit?.deviceName ?? "Unidad"}</span>
                    <span>· {a.geofenceName}</span>
                    <span className="text-muted-foreground">· {timeAgo(a.time)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Mapa + ficha del seleccionado */}
      <div className="relative min-h-[55svh] flex-1">
        <div className="absolute inset-0">
          <div ref={containerRef} className="h-full w-full" />
        </div>
        {current && (
          <div className="absolute inset-x-3 bottom-3 z-10 sm:right-auto sm:left-4 sm:w-[380px]">
            <div className="rounded-2xl border bg-white/95 p-4 shadow-xl shadow-violet-900/10 backdrop-blur">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: current.color }}>
                  <VehicleIcon icon={current.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{current.vehicleName ?? current.deviceName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[current.plate, current.vehicleName ? current.deviceName : null].filter(Boolean).join(" · ") || current.imei}
                  </div>
                </div>
                <Badge variant={isOnline(current.time) ? "success" : "secondary"}>{isOnline(current.time) ? "En línea" : "Sin señal"}</Badge>
                <button onClick={() => setSelected(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted" title="Cerrar">
                  <X className="size-4" />
                </button>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Metric icon={Gauge} label="Velocidad" value={`${(current.speedKmh ?? 0).toFixed(0)} km/h`} />
                {current.kind === "phone" ? (
                  <Metric
                    icon={Battery}
                    label="Batería"
                    value={typeof current.attributes.battery === "number" ? `${current.attributes.battery}%` : "—"}
                  />
                ) : (
                  <Metric icon={Power} label="Motor" value={current.ignition === null ? "—" : current.ignition ? "Encendido" : "Apagado"} />
                )}
                <Metric icon={Clock} label="Reporte" value={timeAgo(current.time)} />
              </dl>
              <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground" title={formatDateTime(current.time)}>
                {current.latitude.toFixed(7)}, {current.longitude.toFixed(7)}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" variant={follow ? "default" : "outline"} onClick={() => setFollow((f) => !f)}>
                  <Crosshair /> {follow ? "Siguiendo" : "Seguir"}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/history?device=${current.deviceId}`}>
                    <History /> Historial
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={googleMapsPlace(current.latitude, current.longitude)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Google Maps
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={googleMapsDirections(current.latitude, current.longitude)} target="_blank" rel="noopener noreferrer">
                    <Navigation /> Cómo llegar
                  </a>
                </Button>
                {canManage && (
                  <Button size="sm" variant="secondary" className="col-span-2" onClick={() => setCommandsOpen(true)}>
                    <Send /> Enviar comando
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {current && canManage && (
        <CommandsDialog
          open={commandsOpen}
          onOpenChange={setCommandsOpen}
          deviceId={current.deviceId}
          deviceName={current.vehicleName ?? current.deviceName}
          protocol={current.kind === "phone" ? "phone" : current.protocol}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl bg-violet-50/70 px-2 py-2">
      <div className={cn("text-xl font-bold", accent)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-2">
      <dt className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="size-3" /> {label}
      </dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}
