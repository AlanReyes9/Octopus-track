"use client";

import { CheckCircle2, Cpu, Link2, Loader2, Send, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { commandsFor, GATEWAY_PROTOCOLS, getProtocol, NATIVE_PROTOCOLS } from "@octopus/telemetry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/fetcher";
import { cn, isOnline, timeAgo } from "@/lib/utils";
import { CommandsDialog } from "./commands-dialog";
import { PairingDialog } from "./pairing-dialog";

interface DeviceRow {
  id: string;
  imei: string;
  name: string;
  kind: "gps" | "phone";
  protocol: string;
  phone: string | null;
  consentAt: string | null;
  consentName: string | null;
  consentRevokedAt: string | null;
  lastSeenAt: string | null;
  vehicleName: string | null;
}

const NATIVE_TCP = NATIVE_PROTOCOLS.filter((p) => p.transport === "tcp");
const NATIVE_OTHER = NATIVE_PROTOCOLS.filter((p) => p.transport === "http" || p.transport === "gateway");

const protocolOf = (d: DeviceRow) => (d.kind === "phone" ? "phone" : d.protocol);

interface Detection {
  protocol: string;
  lastSeen: string;
  messages: number;
}

function ConsentBadge({ d }: { d: DeviceRow }) {
  if (d.kind !== "phone") return <span className="text-muted-foreground">—</span>;
  if (d.consentAt && !d.consentRevokedAt) return <Badge variant="success">Aceptado · {d.consentName}</Badge>;
  if (d.consentRevokedAt) return <Badge variant="destructive">Revocado</Badge>;
  return <Badge variant="warning">Pendiente</Badge>;
}

export function DevicesManager({ initial }: { initial: DeviceRow[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"gps" | "phone">("gps");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pairing, setPairing] = useState<{ url: string; name: string } | null>(null);
  const [commandsTarget, setCommandsTarget] = useState<DeviceRow | null>(null);
  const [protocol, setProtocol] = useState("gt06");
  const [detection, setDetection] = useState<Detection | null>(null);
  const [detecting, setDetecting] = useState(false);

  async function detect(imei: string) {
    setDetection(null);
    if (imei.trim().length < 6) return;
    setDetecting(true);
    try {
      const { detected } = await api<{ detected: Detection | null }>(`/api/devices/detect?imei=${encodeURIComponent(imei.trim())}`);
      setDetection(detected);
      if (detected) setProtocol(detected.protocol);
    } catch {
      /* sin detección */
    } finally {
      setDetecting(false);
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setPending(true);
    setError(null);
    try {
      const res = await api<{ pairingUrl?: string }>("/api/devices", {
        method: "POST",
        json: { ...data, kind, phone: data.phone || null },
      });
      form.reset();
      setDetection(null);
      if (res.pairingUrl) setPairing({ url: res.pairingUrl, name: data.name! });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function regenerate(d: DeviceRow) {
    if (!confirm("Se generará un enlace nuevo. El anterior dejará de funcionar y la persona deberá aceptar de nuevo. ¿Continuar?")) return;
    try {
      const res = await api<{ pairingUrl: string }>(`/api/devices/${d.id}/pairing`, { method: "POST" });
      setPairing({ url: res.pairingUrl, name: d.name });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar el dispositivo y todo su historial de posiciones?")) return;
    try {
      await api(`/api/devices/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Conexión</TableHead>
                <TableHead>Consentimiento</TableHead>
                <TableHead>Última señal</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No hay dispositivos registrados.
                  </TableCell>
                </TableRow>
              )}
              {initial.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                        {d.kind === "phone" ? <Smartphone className="size-4" /> : <Cpu className="size-4" />}
                      </span>
                      <div>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.vehicleName ?? "Sin vehículo"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.imei}</TableCell>
                  <TableCell>
                    <Badge variant="outline" title={getProtocol(protocolOf(d))?.devices}>
                      {getProtocol(protocolOf(d))?.name ?? d.protocol}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ConsentBadge d={d} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={isOnline(d.lastSeenAt) ? "success" : "secondary"} suppressHydrationWarning>{timeAgo(d.lastSeenAt)}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {commandsFor(protocolOf(d)).length > 0 && (
                      <Button variant="ghost" size="icon" onClick={() => setCommandsTarget(d)} title="Comandos">
                        <Send className="text-violet-600" />
                      </Button>
                    )}
                    {d.kind === "phone" && (
                      <Button variant="ghost" size="icon" onClick={() => regenerate(d)} title="Nuevo enlace de vinculación">
                        <Link2 />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onDelete(d.id)} title="Eliminar">
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Nuevo dispositivo</CardTitle>
          <CardDescription>Elige el tipo de equipo a registrar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                ["gps", "Rastreador GPS", Cpu],
                ["phone", "Teléfono", Smartphone],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-muted-foreground transition",
                  kind === k && "bg-white text-violet-700 shadow-sm",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          <form onSubmit={onCreate} className="grid gap-4" key={kind}>
            {kind === "gps" && (
              <div className="grid gap-2">
                <Label htmlFor="imei">IMEI / identificador</Label>
                <Input
                  id="imei"
                  name="imei"
                  required
                  pattern="[A-Za-z0-9_\-]{1,32}"
                  placeholder="356938035643809"
                  onBlur={(e) => detect(e.target.value)}
                />
                {detecting && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Buscando conexiones de este equipo…
                  </p>
                )}
                {detection && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      Equipo detectado: protocolo <strong>{getProtocol(detection.protocol)?.name ?? detection.protocol}</strong>,{" "}
                      {detection.messages} mensajes. Se ha seleccionado automáticamente.
                    </span>
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required placeholder={kind === "gps" ? "GPS Camión 04" : "Teléfono de Ana"} />
            </div>
            {kind === "gps" && (
              <div className="grid gap-2">
                <Label htmlFor="protocol">Protocolo</Label>
                <NativeSelect id="protocol" name="protocol" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
                  <optgroup label="Conexión directa TCP (detección automática)">
                    {NATIVE_TCP.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="HTTP">
                    {NATIVE_OTHER.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Vía servidor de protocolos (gateway)">
                    {GATEWAY_PROTOCOLS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  {getProtocol(protocol)?.devices}. Los equipos TCP se reconocen solos al conectarse.
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="phone">{kind === "gps" ? "SIM / teléfono (opcional)" : "Número (opcional)"}</Label>
              <Input id="phone" name="phone" />
            </div>
            {kind === "phone" && (
              <p className="rounded-lg bg-violet-50 p-3 text-xs text-violet-900">
                Se generará un enlace que la persona debe abrir y aceptar expresamente. Sin su consentimiento no se
                registra ninguna ubicación.
              </p>
            )}
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : kind === "gps" ? "Registrar rastreador" : "Crear enlace de vinculación"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <PairingDialog url={pairing?.url ?? null} name={pairing?.name ?? ""} onClose={() => setPairing(null)} />
      {commandsTarget && (
        <CommandsDialog
          open
          onOpenChange={(o) => !o && setCommandsTarget(null)}
          deviceId={commandsTarget.id}
          deviceName={commandsTarget.name}
          protocol={protocolOf(commandsTarget)}
        />
      )}
    </div>
  );
}
