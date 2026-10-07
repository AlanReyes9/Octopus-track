"use client";

import { AlertTriangle, Check, Copy, Loader2, MapPin, MessageSquare, MoonStar, ShieldCheck, Sun, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { OctopusLogo, OctopusMark } from "@/components/brand/octopus-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "octopus_tracker";
const MIN_INTERVAL_MS = 10_000;
const MIN_DISTANCE_M = 25;
const HEARTBEAT_MS = 60_000;

type SessionInfo = { deviceName: string; company: string; holderName: string | null; consent: "active" | "revoked" | "none" };
type Phase = "loading" | "invalid" | "consent" | "declined" | "tracking" | "stopped";

function distance(a: GeolocationCoordinates, b: GeolocationCoordinates) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function readToken(): string | null {
  try {
    const hash = new URLSearchParams(window.location.hash.slice(1)).get("t");
    if (hash) {
      localStorage.setItem(STORAGE_KEY, hash);
      // Quita el token de la barra de direcciones.
      history.replaceState(null, "", window.location.pathname);
      return hash;
    }
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function PhoneTracker() {
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    [token],
  );

  useEffect(() => {
    const t = readToken();
    if (!t) return setPhase("invalid");
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    call("/api/phone/session").then(({ ok, data }) => {
      if (!ok) return setPhase("invalid");
      setInfo(data);
      setPhase(data.consent === "active" ? "tracking" : "consent");
    });
  }, [token, call]);

  async function accept(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const holderName = String(new FormData(e.currentTarget).get("holderName") ?? "");
    setError(null);
    const { ok, data } = await call("/api/phone/consent", { method: "POST", body: JSON.stringify({ holderName, accept: true }) });
    if (!ok) return setError(data.issues?.[0]?.message ?? data.error ?? "No se pudo registrar tu aceptación");
    setInfo((i) => (i ? { ...i, holderName, consent: "active" } : i));
    setPhase("tracking");
  }

  async function stop() {
    await call("/api/phone/revoke", { method: "POST" });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setPhase("stopped");
  }

  return (
    <main className="flex min-h-svh flex-col bg-gradient-to-b from-violet-50 to-white">
      <header className="flex justify-center p-5">
        <OctopusLogo />
      </header>
      <div className="mx-auto w-full max-w-md flex-1 px-5 pb-10">
        {phase === "loading" && (
          <div className="flex justify-center py-20">
            <Loader2 className="size-8 animate-spin text-violet-600" />
          </div>
        )}

        {phase === "invalid" && (
          <Panel icon={<XCircle className="size-10 text-destructive" />} title="Enlace no válido">
            Este enlace de seguimiento no existe o fue reemplazado. Pide uno nuevo a quien te lo envió.
          </Panel>
        )}

        {phase === "declined" && (
          <Panel icon={<ShieldCheck className="size-10 text-violet-600" />} title="No se compartirá tu ubicación">
            No aceptaste, así que no se ha registrado ningún dato. Puedes cerrar esta página.
          </Panel>
        )}

        {phase === "stopped" && (
          <Panel icon={<ShieldCheck className="size-10 text-violet-600" />} title="Has dejado de compartir">
            Tu consentimiento quedó revocado y ya no se envía tu ubicación. Para volver a compartir necesitarás un enlace nuevo.
          </Panel>
        )}

        {phase === "consent" && info && (
          <div className="space-y-5 rounded-3xl border bg-white p-6 shadow-xl shadow-violet-100">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-violet-100">
                <MapPin className="size-8 text-violet-600" />
              </span>
              <h1 className="text-xl font-bold">¿Compartir tu ubicación?</h1>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{info.company}</strong> te solicita compartir la ubicación de este
                teléfono (<em>{info.deviceName}</em>) a través de Octopus Track.
              </p>
            </div>
            <ul className="space-y-2.5 rounded-2xl bg-violet-50 p-4 text-sm">
              <Li>Se envía tu posición, velocidad y nivel de batería <strong>solo mientras esta página esté abierta</strong>.</Li>
              <Li>La verán los administradores de {info.company} y las personas que ellos autoricen.</Li>
              <Li>Los datos se borran automáticamente a los 180 días.</Li>
              <Li>Puedes <strong>dejar de compartir en cualquier momento</strong> con un botón.</Li>
            </ul>
            <form onSubmit={accept} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="holderName">Tu nombre</Label>
                <Input id="holderName" name="holderName" required minLength={2} defaultValue={info.holderName ?? ""} className="h-11" />
              </div>
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input type="checkbox" required className="mt-0.5 size-4 accent-violet-600" />
                <span>
                  Acepto compartir mi ubicación en los términos anteriores y he leído el{" "}
                  <Link href="/legal/privacidad" target="_blank" className="text-primary underline">aviso de privacidad</Link>.
                </span>
              </label>
              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="h-11 w-full">Aceptar y compartir</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setPhase("declined")}>
                No acepto
              </Button>
            </form>
          </div>
        )}

        {phase === "tracking" && info && token && (
          <Tracking info={info} token={token} call={call} onStop={stop} onRevoked={() => setPhase("consent")} />
        )}
      </div>
    </main>
  );
}

function Tracking(props: {
  info: SessionInfo;
  token: string;
  call: (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; data: any }>;
  onStop: () => void;
  onRevoked: () => void;
}) {
  const [status, setStatus] = useState<"waiting" | "ok" | "denied" | "error">("waiting");
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const last = useRef<{ coords: GeolocationCoordinates; at: number } | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const forceNext = useRef(false);
  const { call, onRevoked } = props;

  const send = useCallback(
    async (pos: GeolocationPosition) => {
      let battery: number | null = null;
      try {
        const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
        battery = nav.getBattery ? (await nav.getBattery()).level : null;
      } catch {}
      const { ok, status: code, data } = await call("/api/ingest/phone", {
        method: "POST",
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
          battery,
        }),
      });
      if (code === 401 || code === 403) return onRevoked();
      if (!ok) return setStatus("error");
      setStatus("ok");
      setLastSent(new Date());
      setSentCount((n) => n + 1);
      for (const c of (data.commands ?? []) as { type: string; params: Record<string, unknown> }[]) {
        if (c.type === "message") setMessage(String(c.params.text ?? ""));
        if (c.type === "requestPosition") forceNext.current = true;
      }
      if (forceNext.current) {
        forceNext.current = false;
        navigator.geolocation.getCurrentPosition((p) => void send(p), undefined, { enableHighAccuracy: true, maximumAge: 0 });
      }
    },
    [call, onRevoked],
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosition.current = pos;
        setAccuracy(Math.round(pos.coords.accuracy));
        const prev = last.current;
        const now = Date.now();
        if (prev && now - prev.at < MIN_INTERVAL_MS && distance(prev.coords, pos.coords) < MIN_DISTANCE_M) return;
        if (prev && now - prev.at < MIN_INTERVAL_MS) return;
        last.current = { coords: pos.coords, at: now };
        void send(pos);
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 },
    );
    // Latido: reenvía la última posición si el teléfono no se mueve.
    const hb = setInterval(() => {
      const p = lastPosition.current;
      if (p && (!last.current || Date.now() - last.current.at >= HEARTBEAT_MS)) {
        last.current = { coords: p.coords, at: Date.now() };
        void send({ coords: p.coords, timestamp: Date.now(), toJSON: () => ({}) } as GeolocationPosition);
      }
    }, 15_000);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(hb);
    };
  }, [send]);

  async function toggleWakeLock() {
    try {
      if (wakeLock) {
        await wakeLock.release();
        setWakeLock(null);
      } else if ("wakeLock" in navigator) {
        setWakeLock(await navigator.wakeLock.request("screen"));
      }
    } catch {}
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-violet-800 p-6 text-white shadow-xl shadow-violet-300/40">
        <div className="flex items-center gap-4">
          <span className="relative flex size-14 items-center justify-center">
            {status === "ok" && <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />}
            <OctopusMark mono className="relative size-12 text-white" />
          </span>
          <div>
            <div className="text-xs tracking-wider text-violet-200 uppercase">
              {status === "ok" ? "Compartiendo ubicación" : status === "waiting" ? "Obteniendo ubicación…" : "Ubicación no disponible"}
            </div>
            <div className="text-lg font-bold">{props.info.holderName ?? props.info.deviceName}</div>
            <div className="text-sm text-violet-200">con {props.info.company}</div>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-white/10 p-2">
            <dt className="text-[11px] text-violet-200">Último envío</dt>
            <dd className="font-semibold">{lastSent ? lastSent.toLocaleTimeString("es") : "—"}</dd>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <dt className="text-[11px] text-violet-200">Precisión</dt>
            <dd className="font-semibold">{accuracy !== null ? `±${accuracy} m` : "—"}</dd>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <dt className="text-[11px] text-violet-200">Envíos</dt>
            <dd className="font-semibold">{sentCount}</dd>
          </div>
        </dl>
      </div>

      {message && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-violet-600" />
          <div className="flex-1">
            <div className="font-semibold">Mensaje de {props.info.company}</div>
            <p>{message}</p>
          </div>
          <button onClick={() => setMessage(null)} className="text-violet-600" aria-label="Cerrar">×</button>
        </div>
      )}

      {status === "denied" && (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            El permiso de ubicación está bloqueado. Actívalo en los ajustes del navegador (en iPhone: Ajustes → Safari →
            Ubicación; en Android: icono del candado → Permisos → Ubicación) y recarga la página.
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-2xl border bg-white p-4 text-sm text-muted-foreground">
        <p>Mantén esta página abierta para seguir compartiendo. Si la cierras o bloqueas el teléfono, el envío se pausa.</p>
        {"wakeLock" in (typeof navigator !== "undefined" ? navigator : {}) && (
          <Button variant="outline" size="sm" onClick={toggleWakeLock} className="w-full">
            <Sun /> {wakeLock ? "Permitir que la pantalla se apague" : "Mantener la pantalla encendida"}
          </Button>
        )}
      </div>

      <BackgroundSetup token={props.token} />

      <Button variant="destructive" className="h-12 w-full text-base" onClick={props.onStop}>
        Dejar de compartir
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/legal/privacidad" className="underline">Aviso de privacidad</Link>
      </p>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border bg-white p-8 text-center shadow-xl shadow-violet-100">
      {icon}
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-violet-600" />
      <span>{children}</span>
    </li>
  );
}

/**
 * Seguimiento en segundo plano: los navegadores pausan la ubicación al
 * bloquear el teléfono, así que se configura una app de rastreo compatible
 * con el protocolo abierto OsmAnd usando la URL personal de este enlace.
 */
function BackgroundSetup({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/ingest/osmand/${token}` : "";
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="rounded-2xl border bg-white p-4 text-sm">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <MoonStar className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Seguir en segundo plano</span>
          <span className="block text-xs text-muted-foreground">Para compartir aunque bloquees el teléfono</span>
        </span>
        <span className="text-xs font-medium text-violet-700">{open ? "Ocultar" : "Configurar"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-muted-foreground">
          <p>
            Los navegadores pausan la ubicación con la pantalla bloqueada. Para enviarla en segundo plano instala una app
            de rastreo gratuita compatible con el protocolo <strong className="text-foreground">OsmAnd</strong>, por ejemplo{" "}
            <strong className="text-foreground">Traccar Client</strong> (código abierto, sin relación con Octopus Track).
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Instálala desde{" "}
              {isIos ? (
                <>la App Store (busca «Traccar Client»)</>
              ) : (
                <a
                  className="text-primary underline"
                  href="https://play.google.com/store/apps/details?id=org.traccar.client"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Play
                </a>
              )}
              .
            </li>
            <li>En «URL del servidor» pega tu dirección personal:</li>
          </ol>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2 py-2 text-xs text-foreground">{url}</code>
            <Button
              size="icon"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
              title="Copiar"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5" start={3}>
            <li>Deja cualquier identificador: el servidor reconoce tu teléfono por la URL.</li>
            <li>Activa el servicio y concede el permiso de ubicación «Siempre» / «Permitir todo el tiempo».</li>
          </ol>
          <p className="rounded-lg bg-violet-50 p-3 text-xs text-violet-900">
            El sistema mostrará siempre un aviso mientras se comparte. Para dejar de compartir, detén el servicio en la app
            o pulsa «Dejar de compartir» aquí: la URL deja de aceptar ubicaciones al instante.
          </p>
        </div>
      )}
    </div>
  );
}
