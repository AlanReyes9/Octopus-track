"use client";

import type { Feature } from "geojson";
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import { Pencil, Trash2, Undo2, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";
import { timeAgo } from "@/lib/utils";
import { GeofenceRulesDialog } from "./geofence-rules-dialog";
import { syncGeofenceLayer, useMap, type GeofenceFeature } from "./use-map";

interface Geofence extends GeofenceFeature {
  areaKm2: number;
}
interface GeofenceEvent {
  time: string;
  type: "enter" | "exit";
  geofenceName: string;
  unit: string;
}

export function GeofenceEditor({ canManage }: { canManage: boolean }) {
  const { containerRef, map } = useMap();
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [ring, setRing] = useState<[number, number][]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f97316");
  const [error, setError] = useState<string | null>(null);
  const [rulesFor, setRulesFor] = useState<{ id: string; name: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  const reload = useCallback(async () => {
    const [g, e] = await Promise.all([
      api<Geofence[]>("/api/geofences"),
      api<GeofenceEvent[]>("/api/geofences/events"),
    ]);
    setGeofences(g);
    setEvents(e);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (map) syncGeofenceLayer(map, geofences);
  }, [map, geofences]);

  // Capa del borrador + captura de clics.
  useEffect(() => {
    if (!map) return;
    map.addSource("draft", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "draft-fill", type: "fill", source: "draft", paint: { "fill-color": "#7c3aed", "fill-opacity": 0.2 } });
    map.addLayer({
      id: "draft-line",
      type: "line",
      source: "draft",
      paint: { "line-color": "#7c3aed", "line-width": 2, "line-dasharray": [2, 1] },
    });
    map.addLayer({
      id: "draft-points",
      type: "circle",
      source: "draft",
      filter: ["==", "$type", "Point"],
      paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#7c3aed", "circle-stroke-width": 2 },
    });
    const onClick = (e: MapMouseEvent) => {
      if (!drawingRef.current) return;
      setRing((r) => [...r, [Number(e.lngLat.lng.toFixed(7)), Number(e.lngLat.lat.toFixed(7))]]);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const features: Feature[] = ring.map((c) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: c },
    }));
    if (ring.length >= 3) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [[...ring, ring[0]!]] },
      });
    } else if (ring.length === 2) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } });
    }
    (map.getSource("draft") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
  }, [map, ring, drawing]);

  function startEdit(g: Geofence) {
    setEditingId(g.id);
    setName(g.name);
    setColor(g.color);
    // El último punto del anillo repite el primero (polígono cerrado); se quita para poder seguir editando vértices.
    const coords = g.geometry.coordinates[0] ?? [];
    setRing(coords.slice(0, -1) as [number, number][]);
    setDrawing(true);
    setError(null);
  }

  function cancelDraw() {
    setDrawing(false);
    setEditingId(null);
    setRing([]);
    setName("");
    setColor("#f97316");
  }

  async function save() {
    setError(null);
    try {
      if (editingId) {
        await api(`/api/geofences/${editingId}`, { method: "PATCH", json: { name, color, ring } });
      } else {
        await api("/api/geofences", { method: "POST", json: { name, color, ring } });
      }
      cancelDraw();
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar la geocerca y sus eventos?")) return;
    await api(`/api/geofences/${id}`, { method: "DELETE" }).catch((err) => alert(err.message));
    if (editingId === id) cancelDraw();
    await reload();
  }

  function focus(g: Geofence) {
    if (!map) return;
    const coords = g.geometry.coordinates[0]!;
    const lngs = coords.map((c) => c[0]!);
    const lats = coords.map((c) => c[1]!);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60 },
    );
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <section className="flex flex-col gap-4 overflow-auto border-b bg-white p-4 lg:w-[340px] lg:border-r lg:border-b-0">
        <h1 className="text-lg font-bold tracking-tight">Geocercas</h1>

        {canManage && (
          <div className="space-y-3 rounded-md border p-3">
            {!drawing ? (
              <Button className="w-full" onClick={() => setDrawing(true)}>
                Dibujar nueva geocerca
              </Button>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {editingId ? "Editando: " : ""}
                  Haz clic en el mapa para añadir vértices ({ring.length}). Mínimo 3.
                </p>
                <div className="grid gap-1.5">
                  <Label htmlFor="gf-name">Nombre</Label>
                  <Input id="gf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Almacén norte" />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="gf-color">Color</Label>
                  <Input
                    id="gf-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-16 p-1"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRing((r) => r.slice(0, -1))} disabled={!ring.length}>
                    <Undo2 /> Deshacer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelDraw}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={save} disabled={ring.length < 3 || !name.trim()}>
                    {editingId ? "Guardar cambios" : "Guardar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <ul className="space-y-1">
          {geofences.length === 0 && <li className="text-sm text-muted-foreground">Sin geocercas.</li>}
          {geofences.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" onClick={() => focus(g)}>
                <span className="size-3 shrink-0 rounded-sm" style={{ background: g.color }} />
                <span className="truncate">{g.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{g.areaKm2.toFixed(2)} km²</span>
              </button>
              {canManage && (
                <>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => setRulesFor(g)} title="Acciones">
                    <Zap className="text-violet-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => startEdit(g)} title="Editar">
                    <Pencil className="text-muted-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => remove(g.id)} title="Eliminar">
                    <Trash2 className="text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div>
          <h2 className="mb-2 text-sm font-medium">Eventos recientes</h2>
          <ul className="space-y-1.5 text-xs">
            {events.length === 0 && <li className="text-muted-foreground">Sin eventos en los últimos 30 días.</li>}
            {events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1">
                <Badge variant={e.type === "enter" ? "success" : "warning"}>{e.type === "enter" ? "Entrada" : "Salida"}</Badge>
                <span className="font-medium">{e.unit}</span>
                <span>· {e.geofenceName}</span>
                <span className="text-muted-foreground">· {timeAgo(e.time)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div ref={containerRef} className="min-h-[55svh] flex-1" />
      <GeofenceRulesDialog geofence={rulesFor} onClose={() => setRulesFor(null)} />
    </div>
  );
}
