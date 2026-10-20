"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";

/**
 * Mapa en vivo con tráfico: requiere una API key de Google Maps con
 * facturación activa (developer.tomtom.com no tiene cobertura de tráfico en
 * RD, por eso se usa Google aquí en vez de un proveedor gratuito). Se
 * configura con NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 */
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Santo Domingo, República Dominicana. */
export const DEFAULT_CENTER_GOOGLE = { lat: 18.4861, lng: -69.9312 };

let optionsSet = false;
function ensureOptions() {
  if (optionsSet) return;
  setOptions({ key: GOOGLE_MAPS_API_KEY, v: "weekly" });
  optionsSet = true;
}

/** Crea el mapa de Google en el contenedor y carga las librerías necesarias. */
export function useGoogleMap(opts: { center?: google.maps.LatLngLiteral; zoom?: number } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerLib, setMarkerLib] = useState<google.maps.MarkerLibrary | null>(null);

  useEffect(() => {
    let disposed = false;
    if (!GOOGLE_MAPS_API_KEY || !containerRef.current) return;
    ensureOptions();
    Promise.all([importLibrary("maps"), importLibrary("marker")]).then(([{ Map }, marker]) => {
      if (disposed || !containerRef.current) return;
      const instance = new Map(containerRef.current, {
        center: opts.center ?? DEFAULT_CENTER_GOOGLE,
        zoom: opts.zoom ?? 12,
        mapId: "DEMO_MAP_ID",
        disableDefaultUI: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      setMap(instance);
      setMarkerLib(marker);
    });
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, map, markerLib };
}
