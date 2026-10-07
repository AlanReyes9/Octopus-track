"use client";

import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

/**
 * Estilo vectorial de OpenFreeMap (gratuito, sin clave y apto para uso
 * comercial; incluye la atribución a OpenStreetMap/OpenMapTiles).
 * Configurable con NEXT_PUBLIC_MAP_STYLE_URL (p. ej. un servidor propio).
 */
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";

export const DEFAULT_CENTER: [number, number] = [-99.1332, 19.4326];

type MapLib = typeof import("maplibre-gl");

/**
 * Crea un mapa MapLibre en el contenedor. maplibre-gl se importa de forma
 * dinámica porque accede a `window` (no es compatible con SSR).
 */
export function useMap(opts: { center?: [number, number]; zoom?: number } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [lib, setLib] = useState<MapLib | null>(null);
  // Nota: con estilos vectoriales "load" llega tras descargar el estilo.

  useEffect(() => {
    let disposed = false;
    let instance: MapLibreMap | null = null;
    import("maplibre-gl").then((maplibre) => {
      if (disposed || !containerRef.current) return;
      instance = new maplibre.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: opts.center ?? DEFAULT_CENTER,
        zoom: opts.zoom ?? 11,
        attributionControl: { compact: true },
      });
      instance.addControl(new maplibre.NavigationControl(), "top-right");
      instance.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      instance.on("load", () => {
        if (disposed) return;
        setLib(maplibre);
        setMap(instance);
      });
    });
    return () => {
      disposed = true;
      instance?.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, map, lib };
}

export interface GeofenceFeature {
  id: string;
  name: string;
  color: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

/** Pinta (o actualiza) las geocercas como capa de relleno + borde. */
export function syncGeofenceLayer(map: MapLibreMap, geofences: GeofenceFeature[]) {
  const data: FeatureCollection = {
    type: "FeatureCollection",
    features: geofences.map((g) => ({
      type: "Feature",
      id: g.id,
      properties: { id: g.id, name: g.name, color: g.color },
      geometry: g.geometry,
    })),
  };
  const src = map.getSource("geofences") as import("maplibre-gl").GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
    return;
  }
  map.addSource("geofences", { type: "geojson", data });
  map.addLayer({
    id: "geofences-fill",
    type: "fill",
    source: "geofences",
    paint: { "fill-color": ["get", "color"], "fill-opacity": 0.15 },
  });
  map.addLayer({
    id: "geofences-line",
    type: "line",
    source: "geofences",
    paint: { "line-color": ["get", "color"], "line-width": 2 },
  });
}
