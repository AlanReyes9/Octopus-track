"use client";

import { AlertTriangle, Loader2, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { commandsFor, getCommand, type DeviceTransport } from "@octopus/telemetry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";
import { timeAgo } from "@/lib/utils";

interface CommandRow {
  id: string;
  type: string;
  status: "pending" | "sent" | "delivered" | "failed" | "cancelled";
  result: string | null;
  createdAt: string;
}

const STATUS: Record<CommandRow["status"], { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  pending: { label: "En cola", variant: "secondary" },
  sent: { label: "Enviado", variant: "warning" },
  delivered: { label: "Confirmado", variant: "success" },
  failed: { label: "Fallido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

const TRANSPORT_NOTE: Record<DeviceTransport, string> = {
  "tcp-text": "Se entrega al instante si el equipo está conectado; si no, al reconectar (válido 24 h).",
  gateway: "Se reenvía al servidor de protocolos configurado por el administrador.",
  phone: "El teléfono lo recibe en su siguiente reporte de ubicación.",
  osmand: "",
};

export function CommandsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  deviceName: string;
  transport: DeviceTransport | null;
}) {
  const available = props.transport ? commandsFor(props.transport) : [];
  const [type, setType] = useState<string>(available[0]?.type ?? "");
  const [params, setParams] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [history, setHistory] = useState<CommandRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const def = getCommand(type);

  const load = useCallback(async () => {
    setHistory(await api<CommandRow[]>(`/api/devices/${props.deviceId}/commands`).catch(() => []));
  }, [props.deviceId]);

  useEffect(() => {
    if (!props.open) return;
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [props.open, load]);

  useEffect(() => {
    setParams({});
    setConfirmed(false);
    setError(null);
  }, [type]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/api/devices/${props.deviceId}/commands`, { method: "POST", json: { type, params } });
      setParams({});
      setConfirmed(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function cancel(id: string) {
    await api(`/api/commands/${id}`, { method: "DELETE" }).catch((err) => setError(err.message));
    await load();
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Comandos · {props.deviceName}</DialogTitle>
          <DialogDescription>{props.transport ? TRANSPORT_NOTE[props.transport] : ""}</DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            Este equipo usa un protocolo de solo envío de posiciones y no admite comandos.
          </p>
        ) : (
          <form onSubmit={send} className="grid gap-4 rounded-xl border bg-muted/30 p-4">
            <div className="grid gap-2">
              <Label htmlFor="cmd-type">Comando</Label>
              <NativeSelect id="cmd-type" value={type} onChange={(e) => setType(e.target.value)} className="bg-white">
                {available.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
              {def && <p className="text-xs text-muted-foreground">{def.description}</p>}
            </div>
            {def?.params?.map((p) => (
              <div key={p.key} className="grid gap-2">
                <Label htmlFor={`p-${p.key}`}>{p.label}</Label>
                <Input
                  id={`p-${p.key}`}
                  className="bg-white"
                  type={p.kind === "number" ? "number" : "text"}
                  min={p.min}
                  max={p.max}
                  maxLength={p.maxLength}
                  required
                  value={params[p.key] ?? ""}
                  onChange={(e) => setParams((s) => ({ ...s, [p.key]: e.target.value }))}
                />
              </div>
            ))}
            {def?.dangerous && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span className="flex-1">
                  Confirmo que el vehículo está detenido en un lugar seguro y que tengo autorización para bloquearlo.
                </span>
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-violet-600" />
              </label>
            )}
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending || (def?.dangerous && !confirmed)} variant={def?.dangerous ? "destructive" : "default"}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />} Enviar comando
            </Button>
          </form>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold">Historial</h3>
          <ul className="divide-y rounded-xl border text-sm">
            {history.length === 0 && <li className="p-3 text-muted-foreground">Sin comandos enviados.</li>}
            {history.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{getCommand(c.type)?.label ?? c.type}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {timeAgo(c.createdAt)}
                    {c.result ? ` · ${c.result}` : ""}
                  </div>
                </div>
                <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>
                {c.status === "pending" && (
                  <Button size="icon" variant="ghost" className="size-7" title="Cancelar" onClick={() => cancel(c.id)}>
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
