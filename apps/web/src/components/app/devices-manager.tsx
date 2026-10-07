"use client";

import { Cpu, Link2, Send, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DeviceTransport } from "@octopus/telemetry";
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

const PROTOCOLS = [
  { value: "gateway", label: "Gateway HTTP JSON (servidor de protocolos)" },
  { value: "tcp-text", label: "TCP texto ($POS)" },
  { value: "osmand", label: "HTTP OsmAnd (apps móviles)" },
];
const PROTOCOL_LABEL: Record<string, string> = { gateway: "Gateway JSON", "tcp-text": "TCP $POS", osmand: "OsmAnd", phone: "Navegador" };

function transportOf(d: DeviceRow): DeviceTransport | null {
  if (d.kind === "phone") return "phone";
  return d.protocol === "gateway" || d.protocol === "tcp-text" ? d.protocol : null;
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
  const [commandsFor, setCommandsFor] = useState<DeviceRow | null>(null);

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
    <div className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
      <Card className="py-2">
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
                    <Badge variant="outline">{PROTOCOL_LABEL[d.protocol] ?? d.protocol}</Badge>
                  </TableCell>
                  <TableCell>
                    <ConsentBadge d={d} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={isOnline(d.lastSeenAt) ? "success" : "secondary"} suppressHydrationWarning>{timeAgo(d.lastSeenAt)}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {transportOf(d) && (
                      <Button variant="ghost" size="icon" onClick={() => setCommandsFor(d)} title="Comandos">
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
                <Input id="imei" name="imei" required pattern="[A-Za-z0-9_\-]{1,32}" placeholder="356938035643809" />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required placeholder={kind === "gps" ? "GPS Camión 04" : "Teléfono de Ana"} />
            </div>
            {kind === "gps" && (
              <div className="grid gap-2">
                <Label htmlFor="protocol">Conexión</Label>
                <NativeSelect id="protocol" name="protocol" defaultValue="gateway">
                  {PROTOCOLS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </NativeSelect>
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
      {commandsFor && (
        <CommandsDialog
          open
          onOpenChange={(o) => !o && setCommandsFor(null)}
          deviceId={commandsFor.id}
          deviceName={commandsFor.name}
          transport={transportOf(commandsFor)}
        />
      )}
    </div>
  );
}
