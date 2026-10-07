"use client";

import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

/** Estilo base con teselas raster de OpenStreetMap (sin claves ni pagos). */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

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

  useEffect(() => {
    let disposed = false;
    let instance: MapLibreMap | null = null;
    import("maplibre-gl").then((maplibre) => {
      if (disposed || !containerRef.current) return;
      instance = new maplibre.Map({
        container: containerRef.current,
        style: OSM_STYLE,
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
