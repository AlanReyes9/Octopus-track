"use client";

import type { Feature } from "geojson";
import type { GeoJSONSource, Marker } from "maplibre-gl";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";
import { googleMapsPlace } from "@/lib/maps-links";
import { cn, formatDateTime, formatDuration } from "@/lib/utils";
import type { HistoryPoint } from "@/server/positions";
import type { StopDto, StopsReport } from "@/server/positions";
import { CollapsibleMapPanel } from "./collapsible-panel";
import { useMap } from "./use-map";
import { createVehicleMarkerElement, setMarkerCourse } from "./vehicle-marker";

interface HistoryResponse {
  points: HistoryPoint[];
  totalPoints: number;
  sampled: boolean;
  summary: { distanceKm: number; maxSpeedKmh: number; avgSpeedKmh: number; start: string | null; end: string | null };
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

type Tab = "route" | "stops";

export function HistoryViewer({
  devices,
  initialDeviceId,
}: {
  devices: { id: string; label: string; icon: string; color: string }[];
  initialDeviceId?: string;
}) {
  const { containerRef, map, lib } = useMap();
  const now = new Date();
  const [tab, setTab] = useState<Tab>("route");
  const [deviceId, setDeviceId] = useState(initialDeviceId ?? devices[0]?.id ?? "");
  const [from, setFrom] = useState(toLocalInput(new Date(now.getTime() - 24 * 3600_000)));
  const [to, setTo] = useState(toLocalInput(now));
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [stops, setStops] = useState<StopsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedStop, setSelectedStop] = useState<{ stop: StopDto; index: number } | null>(null);
  const marker = useRef<Marker | null>(null);
  const stopMarkers = useRef<Marker[]>([]);

  // Carga a la vez el recorrido y las paradas: las paradas se superponen en el
  // mapa en ambas pestañas, así que no tiene sentido pedirlas por separado.
  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setSelectedStop(null);
    const qs = new URLSearchParams({ deviceId, from: new Date(from).toISOString(), to: new Date(to).toISOString() });
    try {
      const [historyRes, stopsRes] = await Promise.all([
        api<HistoryResponse>(`/api/positions/history?${qs}`),
        api<StopsReport>(`/api/positions/stops?${qs}`),
      ]);
      setData(historyRes);
      setStops(stopsRes);
      setCursor(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Carga automática cuando se llega desde el mapa en vivo.
  useEffect(() => {
    if (initialDeviceId && map) void load();
  }, [initialDeviceId, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dibuja la ruta (solo en la pestaña Recorrido).
  useEffect(() => {
    if (!map || !lib || tab !== "route" || !data) return;
    const line: Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: data.points.map((p) => [p.longitude, p.latitude]) },
    };
    const src = map.getSource("route") as GeoJSONSource | undefined;
    if (src) src.setData(line);
    else {
      map.addSource("route", { type: "geojson", data: line });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 7 },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#7c3aed", "line-width": 4 },
      });
    }
    if (data.points.length) {
      const b = new lib.LngLatBounds();
      data.points.forEach((p) => b.extend([p.longitude, p.latitude]));
      map.fitBounds(b, { padding: 60, maxZoom: 16 });
    }
  }, [map, lib, data, tab]);

  // Marcadores de paradas: se muestran sobre el recorrido en ambas pestañas.
  // Un clic selecciona la parada (se ve en el panel, sin salir a Google Maps).
  useEffect(() => {
    stopMarkers.current.forEach((m) => m.remove());
    stopMarkers.current = [];
    if (!map || !lib || !stops || stops.stops.length === 0) return;
    const b = new lib.LngLatBounds();
    stops.stops.forEach((s, i) => {
      const el = document.createElement("div");
      el.className =
        "flex size-7 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-xs font-bold text-white shadow-md cursor-pointer";
      el.textContent = String(i + 1);
      el.title = `Parada ${i + 1}: ${formatDuration(s.durationSeconds)}`;
      el.addEventListener("click", () => {
        setSelectedStop({ stop: s, index: i + 1 });
        map.flyTo({ center: [s.longitude, s.latitude], zoom: Math.max(map.getZoom(), 15) });
      });
      const m = new lib.Marker({ element: el }).setLngLat([s.longitude, s.latitude]).addTo(map);
      stopMarkers.current.push(m);
      b.extend([s.longitude, s.latitude]);
    });
    if (tab === "stops") map.fitBounds(b, { padding: 60, maxZoom: 16 });
  }, [map, lib, stops, tab]);

  // Marcador de reproducción: mismo icono y color que tiene la unidad en el mapa en vivo.
  // Se recrea cuando cambia la unidad para que el icono nunca quede desactualizado.
  const current = data?.points[cursor];
  const selectedDevice = devices.find((d) => d.id === deviceId);
  useEffect(() => {
    marker.current?.remove();
    marker.current = null;
  }, [deviceId]);
  useEffect(() => {
    if (!map || !lib || tab !== "route") return;
    if (!current) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new lib.Marker({ element: createVehicleMarkerElement(selectedDevice?.color ?? "#7c3aed", selectedDevice?.icon) })
        .setLngLat([current.longitude, current.latitude])
        .addTo(map);
    }
    marker.current.setLngLat([current.longitude, current.latitude]);
    setMarkerCourse(marker.current.getElement(), current.course);
  }, [map, lib, current, selectedDevice, tab]);

  useEffect(() => {
    if (!playing || !data) return;
    const t = setInterval(() => {
      setCursor((c) => {
        if (c >= data.points.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 120);
    return () => clearInterval(t);
  }, [playing, data]);

  return (
    <div className="relative h-full min-h-screen">
      {/* MapLibre fuerza position:relative en su contenedor, así que el que
          le pasamos (containerRef) no puede ser el que usa "absolute inset-0"
          para ocupar todo el espacio; por eso va envuelto en otro div. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {selectedStop && <StopDetailCard selected={selectedStop} onClose={() => setSelectedStop(null)} />}
      <CollapsibleMapPanel>
        <h1 className="text-lg font-bold tracking-tight">Historial</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            className={cn("flex-1 rounded-md py-1.5 font-medium", tab === "route" ? "bg-white shadow-sm" : "text-muted-foreground")}
            onClick={() => setTab("route")}
          >
            Recorrido
          </button>
          <button
            type="button"
            className={cn("flex-1 rounded-md py-1.5 font-medium", tab === "stops" ? "bg-white shadow-sm" : "text-muted-foreground")}
            onClick={() => setTab("stops")}
          >
            Paradas
          </button>
        </div>
        <form onSubmit={load} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="device">Unidad</Label>
            <NativeSelect id="device" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              {devices.length === 0 && <option value="">Sin dispositivos</option>}
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading || !deviceId}>
            {loading ? "Cargando…" : "Consultar"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        {tab === "route" && data && (
          <div className="space-y-3 text-sm">
            {data.points.length === 0 ? (
              <p className="text-muted-foreground">No hay posiciones en ese rango.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2">
                  <Metric label="Distancia" value={`${data.summary.distanceKm.toFixed(2)} km`} />
                  <Metric label="Vel. máxima" value={`${data.summary.maxSpeedKmh.toFixed(0)} km/h`} />
                  <Metric label="Vel. media" value={`${data.summary.avgSpeedKmh.toFixed(0)} km/h`} />
                  <Metric label="Puntos" value={data.totalPoints.toLocaleString("es")} />
                </dl>
                {data.sampled && (
                  <p className="text-xs text-muted-foreground">Ruta submuestreada para la visualización.</p>
                )}
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setPlaying((p) => !p)}>
                      {playing ? <Pause /> : <Play />}
                    </Button>
                    <input
                      type="range"
                      min={0}
                      max={data.points.length - 1}
                      value={cursor}
                      onChange={(e) => setCursor(Number(e.target.value))}
                      className="flex-1"
                    />
                  </div>
                  {current && (
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(current.time)} · {(current.speedKmh ?? 0).toFixed(0)} km/h
                      <div className="font-mono">
                        {current.latitude.toFixed(7)}, {current.longitude.toFixed(7)}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "stops" && stops && (
          <div className="space-y-3 text-sm">
            {stops.stops.length === 0 ? (
              <p className="text-muted-foreground">
                Sin paradas de al menos 2 minutos en ese rango (velocidad por debajo de 3 km/h).
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2">
                  <Metric label="Paradas" value={String(stops.totalStops)} />
                  <Metric label="Tiempo parado" value={formatDuration(stops.totalStoppedSeconds)} />
                </dl>
                <Button size="sm" variant="outline" className="w-full" onClick={() => exportStopsCsv(stops, selectedDevice?.label)}>
                  Exportar CSV
                </Button>
                <ul className="space-y-2">
                  {stops.stops.map((s, i) => (
                    <StopRow
                      key={s.start}
                      index={i + 1}
                      stop={s}
                      selected={selectedStop?.stop.start === s.start}
                      onSelect={() => {
                        setSelectedStop({ stop: s, index: i + 1 });
                        map?.flyTo({ center: [s.longitude, s.latitude], zoom: Math.max(map.getZoom(), 15) });
                      }}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CollapsibleMapPanel>
    </div>
  );
}

function StopDetailCard({ selected, onClose }: { selected: { stop: StopDto; index: number }; onClose: () => void }) {
  const { stop, index } = selected;
  return (
    <div className="absolute right-3 top-3 z-10 w-72 rounded-xl border bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
            {index}
          </span>
          Parada {index}
        </span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
          ✕
        </button>
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Duración</dt>
          <dd className="font-medium">{formatDuration(stop.durationSeconds)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Desde</dt>
          <dd className="text-right">{formatDateTime(stop.start)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Hasta</dt>
          <dd className="text-right">{formatDateTime(stop.end)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Ubicación</dt>
          <dd className="text-right font-mono text-xs">
            {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
          </dd>
        </div>
      </dl>
      <a
        href={googleMapsPlace(stop.latitude, stop.longitude)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-violet-600 hover:underline"
      >
        Abrir en Google Maps ↗
      </a>
    </div>
  );
}

function StopRow({
  index,
  stop,
  selected,
  onSelect,
}: {
  index: number;
  stop: StopDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn("w-full rounded-lg border p-2.5 text-left transition", selected ? "border-violet-400 bg-violet-50" : "hover:bg-muted/50")}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
              {index}
            </span>
            Parada {index}
          </span>
          <Badge variant="warning">{formatDuration(stop.durationSeconds)}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(stop.start)} → {formatDateTime(stop.end)}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
        </p>
      </button>
    </li>
  );
}

function exportStopsCsv(report: StopsReport, deviceLabel?: string) {
  const header = "Inicio,Fin,Duración (min),Latitud,Longitud\n";
  const rows = report.stops
    .map((s) =>
      [
        formatDateTime(s.start),
        formatDateTime(s.end),
        (s.durationSeconds / 60).toFixed(1),
        s.latitude.toFixed(7),
        s.longitude.toFixed(7),
      ]
        .map((v) => `"${v}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`﻿${header}${rows}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paradas-${(deviceLabel ?? "unidad").replace(/\W+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-violet-50/70 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
