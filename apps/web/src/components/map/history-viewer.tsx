"use client";

import type { Feature } from "geojson";
import type { GeoJSONSource, Marker } from "maplibre-gl";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/utils";
import type { HistoryPoint } from "@/server/positions";
import { useMap } from "./use-map";
import { createVehicleMarkerElement, setMarkerCourse } from "./vehicle-marker";

interface HistoryResponse {
  points: HistoryPoint[];
  totalPoints: number;
  sampled: boolean;
  summary: { distanceKm: number; maxSpeedKmh: number; avgSpeedKmh: number; start: string | null; end: string | null };
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function HistoryViewer({ devices }: { devices: { id: string; label: string }[] }) {
  const { containerRef, map, lib } = useMap();
  const now = new Date();
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [from, setFrom] = useState(toLocalInput(new Date(now.getTime() - 24 * 3600_000)));
  const [to, setTo] = useState(toLocalInput(now));
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const marker = useRef<Marker | null>(null);

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    setPlaying(false);
    try {
      const qs = new URLSearchParams({
        deviceId,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      });
      const res = await api<HistoryResponse>(`/api/positions/history?${qs}`);
      setData(res);
      setCursor(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Dibuja la ruta.
  useEffect(() => {
    if (!map || !lib || !data) return;
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
        paint: { "line-color": "#2563eb", "line-width": 4 },
      });
    }
    if (data.points.length) {
      const b = new lib.LngLatBounds();
      data.points.forEach((p) => b.extend([p.longitude, p.latitude]));
      map.fitBounds(b, { padding: 60, maxZoom: 16 });
    }
  }, [map, lib, data]);

  // Marcador de reproducción.
  const current = data?.points[cursor];
  useEffect(() => {
    if (!map || !lib) return;
    if (!current) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new lib.Marker({ element: createVehicleMarkerElement("#dc2626") })
        .setLngLat([current.longitude, current.latitude])
        .addTo(map);
    }
    marker.current.setLngLat([current.longitude, current.latitude]);
    setMarkerCourse(marker.current.getElement(), current.course);
  }, [map, lib, current]);

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
    <div className="flex h-full flex-col lg:flex-row">
      <section className="space-y-4 border-b p-4 lg:w-80 lg:border-r lg:border-b-0">
        <h1 className="font-semibold">Historial de rutas</h1>
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
            {loading ? "Cargando…" : "Ver recorrido"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        {data && (
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
      </section>
      <div ref={containerRef} className="min-h-[55svh] flex-1" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
