"use client";

import type { LiveMessage } from "@octopus/telemetry";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LivePosition } from "@/server/positions";

export type LiveMode = "connecting" | "websocket" | "polling";
type GeofenceAlert = Extract<LiveMessage, { type: "geofence" }>;

const POLL_MS = 10_000;

/**
 * Posiciones en vivo del tenant. Usa el gateway WebSocket (Redis Pub/Sub)
 * cuando está configurado; si no, o si la conexión falla, recurre a polling.
 */
export function useLivePositions() {
  const [positions, setPositions] = useState<Record<string, LivePosition>>({});
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [mode, setMode] = useState<LiveMode>("connecting");
  const [loaded, setLoaded] = useState(false);
  const stopped = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/positions/latest", { cache: "no-store" });
    if (!res.ok) return;
    const list: LivePosition[] = await res.json();
    setPositions(Object.fromEntries(list.map((p) => [p.deviceId, p])));
    setLoaded(true);
  }, []);

  useEffect(() => {
    stopped.current = false;
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const startPolling = () => {
      setMode("polling");
      if (!pollTimer) pollTimer = setInterval(refresh, POLL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const onMessage = (ev: MessageEvent) => {
      let msg: LiveMessage | { type: "hello" };
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "position") {
        setPositions((prev) => {
          const current = prev[msg.deviceId];
          // Dispositivo nuevo para la UI: recargar para obtener nombre/color.
          if (!current) {
            void refresh();
            return prev;
          }
          if (new Date(msg.time) < new Date(current.time)) return prev;
          return {
            ...prev,
            [msg.deviceId]: {
              ...current,
              time: msg.time,
              latitude: msg.latitude,
              longitude: msg.longitude,
              speedKmh: msg.speedKmh,
              course: msg.course,
              ignition: msg.ignition,
            },
          };
        });
      } else if (msg.type === "geofence") {
        setAlerts((prev) => [msg, ...prev].slice(0, 20));
      }
    };

    const connect = async () => {
      if (stopped.current) return;
      try {
        const res = await fetch("/api/realtime/token", { cache: "no-store" });
        const { url, token } = (await res.json()) as { url: string | null; token: string | null };
        if (!url || !token) return startPolling();
        ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
        ws.onopen = () => {
          attempts = 0;
          stopPolling();
          setMode("websocket");
          void refresh(); // re-sincroniza lo perdido durante la desconexión
        };
        ws.onmessage = onMessage;
        ws.onclose = () => {
          if (stopped.current) return;
          startPolling();
          const delay = Math.min(30_000, 1000 * 2 ** attempts++);
          retryTimer = setTimeout(connect, delay);
        };
      } catch {
        startPolling();
      }
    };

    void refresh();
    void connect();

    return () => {
      stopped.current = true;
      stopPolling();
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [refresh]);

  return { positions: Object.values(positions), alerts, mode, loaded, refresh };
}
