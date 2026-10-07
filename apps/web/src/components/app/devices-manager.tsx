"use client";

import { CheckCircle2, Cpu, Link2, Loader2, Pencil, Send, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { commandsFor, GATEWAY_PROTOCOLS, getProtocol, NATIVE_PROTOCOLS } from "@octopus/telemetry";
import { VehicleIcon } from "@/components/brand/vehicle-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/fetcher";
import { cn, isOnline, timeAgo } from "@/lib/utils";
import { CommandsDialog } from "./commands-dialog";
import { PairingDialog } from "./pairing-dialog";
import { IconColorPicker } from "./unit-fields";

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
  vehicleId: string | null;
  vehicleName: string | null;
  plate: string | null;
  color: string | null;
  icon: string | null;
}

interface Detection {
  protocol: string;
  lastSeen: string;
  messages: number;
}

const NATIVE_TCP = NATIVE_PROTOCOLS.filter((p) => p.transport === "tcp");
const NATIVE_OTHER = NATIVE_PROTOCOLS.filter((p) => p.transport === "http" || p.transport === "gateway");
const protocolOf = (d: DeviceRow) => (d.kind === "phone" ? "phone" : d.protocol);

function ProtocolSelect(props: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <NativeSelect id={props.id} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
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
  );
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
  const [icon, setIcon] = useState("car");
  const [color, setColor] = useState("#7c3aed");
  const [protocol, setProtocol] = useState("gt06");
  const [detection, setDetection] = useState<Detection | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pairing, setPairing] = useState<{ url: string; name: string } | null>(null);
  const [commandsTarget, setCommandsTarget] = useState<DeviceRow | null>(null);
  const [editing, setEditing] = useState<DeviceRow | null>(null);

  function switchKind(k: "gps" | "phone") {
    setKind(k);
    setIcon(k === "phone" ? "person" : "car");
    setError(null);
    setDetection(null);
  }

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
        json:
          kind === "gps"
            ? { kind, imei: data.imei, protocol, name: data.name, plate: data.plate || null, phone: data.phone || null, icon, color }
            : { kind, name: data.name, phone: data.phone || null, icon, color },
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
      setPairing({ url: res.pairingUrl, name: d.vehicleName ?? d.name });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function onDelete(d: DeviceRow) {
    if (!confirm(`¿Eliminar "${d.vehicleName ?? d.name}" con todo su historial de posiciones?`)) return;
    try {
      await api(`/api/devices/${d.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="min-w-0 py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidad</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Protocolo</TableHead>
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
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ background: d.color ?? "#7c3aed" }}
                      >
                        <VehicleIcon icon={d.icon ?? (d.kind === "phone" ? "person" : "car")} className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{d.vehicleName ?? d.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.plate ?? (d.kind === "phone" ? "Teléfono" : "Sin placa")}
                        </div>
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
                    <Badge variant={isOnline(d.lastSeenAt) ? "success" : "secondary"} suppressHydrationWarning>
                      {timeAgo(d.lastSeenAt)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(d)} title="Editar">
                      <Pencil />
                    </Button>
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
                    <Button variant="ghost" size="icon" onClick={() => onDelete(d)} title="Eliminar">
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
          <CardDescription>Registra el equipo y la unidad que lo lleva en un solo paso.</CardDescription>
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
                onClick={() => switchKind(k)}
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
            <div className="grid gap-2">
              <Label htmlFor="name">{kind === "gps" ? "Nombre de la unidad" : "Nombre"}</Label>
              <Input id="name" name="name" required placeholder={kind === "gps" ? "Camión 04" : "Ana López"} />
            </div>
            {kind === "gps" && (
              <div className="grid gap-2">
                <Label htmlFor="plate">Placa (opcional)</Label>
                <Input id="plate" name="plate" placeholder="ABC-123" />
              </div>
            )}
            <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />

            {kind === "gps" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="imei">IMEI / identificador del equipo</Label>
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
                <div className="grid gap-2">
                  <Label htmlFor="protocol">Protocolo</Label>
                  <ProtocolSelect id="protocol" value={protocol} onChange={setProtocol} />
                  <p className="text-xs text-muted-foreground">
                    {getProtocol(protocol)?.devices}. Los equipos TCP se reconocen solos al conectarse.
                  </p>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="phone">{kind === "gps" ? "SIM / teléfono del equipo (opcional)" : "Número (opcional)"}</Label>
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
              {pending ? "Guardando…" : kind === "gps" ? "Registrar dispositivo" : "Crear enlace de vinculación"}
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
          deviceName={commandsTarget.vehicleName ?? commandsTarget.name}
          protocol={protocolOf(commandsTarget)}
        />
      )}
      {editing && <EditDialog device={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditDialog({ device, onClose }: { device: DeviceRow; onClose: () => void }) {
  const router = useRouter();
  const [icon, setIcon] = useState(device.icon ?? (device.kind === "phone" ? "person" : "car"));
  const [color, setColor] = useState(device.color ?? "#7c3aed");
  const [protocol, setProtocol] = useState(device.protocol);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setPending(true);
    setError(null);
    try {
      await api(`/api/devices/${device.id}`, {
        method: "PATCH",
        json: {
          name: data.name,
          plate: device.kind === "gps" ? data.plate || null : undefined,
          phone: data.phone || null,
          icon,
          color,
          ...(device.kind === "gps" ? { protocol } : {}),
        },
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar dispositivo</DialogTitle>
          <DialogDescription className="font-mono">{device.imei}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="e-name">Nombre</Label>
            <Input id="e-name" name="name" required defaultValue={device.vehicleName ?? device.name} />
          </div>
          {device.kind === "gps" && (
            <div className="grid gap-2">
              <Label htmlFor="e-plate">Placa</Label>
              <Input id="e-plate" name="plate" defaultValue={device.plate ?? ""} />
            </div>
          )}
          <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />
          {device.kind === "gps" && (
            <div className="grid gap-2">
              <Label htmlFor="e-protocol">Protocolo</Label>
              <ProtocolSelect id="e-protocol" value={protocol} onChange={setProtocol} />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="e-phone">{device.kind === "gps" ? "SIM / teléfono del equipo" : "Número"}</Label>
            <Input id="e-phone" name="phone" defaultValue={device.phone ?? ""} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
