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

/** Santo Domingo, República Dominicana. */
export const DEFAULT_CENTER: [number, number] = [-69.9312, 18.4861];

/**
 * Token gratuito de Mapbox para la capa de tráfico en tiempo real del
 * "Mapa en vivo" (el resto del mapa sigue siendo OpenFreeMap). Se saca en
 * https://account.mapbox.com/access-tokens/ (no pide tarjeta para el uso
 * normal de esta app) y se configura como NEXT_PUBLIC_MAPBOX_TOKEN. Sin él,
 * el botón de tráfico se deshabilita.
 */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

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
        // Safari a veces mide el contenedor antes de que termine de asentarse
        // el layout (fuentes, barras del navegador, etc.) y el ResizeObserver
        // no siempre dispara a tiempo ahí; se insiste con resize() varias
        // veces en los primeros segundos como red de seguridad.
        for (const delay of [50, 150, 300, 600, 1200, 2500]) {
          setTimeout(() => {
            if (!disposed) instance?.resize();
          }, delay);
        }
      });
    });
    return () => {
      disposed = true;
      instance?.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El contenedor puede cambiar de tamaño sin que la ventana dispare "resize"
  // (p. ej. al abrir/cerrar el panel retráctil, o si el layout se asienta
  // después de que el mapa ya midió su tamaño inicial); sin esto el canvas
  // queda con el tamaño viejo y el mapa se ve recortado.
  useEffect(() => {
    if (!map || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);
    // Safari puede dejar el lienzo WebGL en blanco al volver de la caché de
    // navegación (bfcache) o al cambiar de pestaña; re-medir al recuperar
    // visibilidad es la forma recomendada de recuperarlo.
    const onShow = () => map.resize();
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      ro.disconnect();
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [map]);

  return { containerRef, map, lib };
}

const TRAFFIC_SOURCE_ID = "traffic-flow";
const TRAFFIC_LAYER_ID = "traffic-flow-layer";

/**
 * Agrega o quita la capa de tráfico en tiempo real (tiles vectoriales de
 * Mapbox) sobre el mapa: líneas de calles coloreadas según congestión.
 */
export function setTrafficLayer(map: MapLibreMap, visible: boolean) {
  if (!visible) {
    if (map.getLayer(TRAFFIC_LAYER_ID)) map.removeLayer(TRAFFIC_LAYER_ID);
    if (map.getSource(TRAFFIC_SOURCE_ID)) map.removeSource(TRAFFIC_SOURCE_ID);
    return;
  }
  if (map.getSource(TRAFFIC_SOURCE_ID)) return;
  map.addSource(TRAFFIC_SOURCE_ID, {
    type: "vector",
    tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/{z}/{x}/{y}.vector.pbf?access_token=${MAPBOX_TOKEN}`],
    attribution: "© Mapbox",
  });
  map.addLayer({
    id: TRAFFIC_LAYER_ID,
    type: "line",
    source: TRAFFIC_SOURCE_ID,
    "source-layer": "traffic",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-width": 2.5,
      "line-color": [
        "match",
        ["get", "congestion"],
        "low",
        "#4CAF50",
        "moderate",
        "#FFC107",
        "heavy",
        "#FF9800",
        "severe",
        "#F44336",
        "#9E9E9E",
      ],
    },
  });
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
