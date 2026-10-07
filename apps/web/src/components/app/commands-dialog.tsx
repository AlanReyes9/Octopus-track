"use client";

import { AlertTriangle, BookmarkPlus, Loader2, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { commandsFor, getCommand, getProtocol, type CommandDefinition } from "@octopus/telemetry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";
import { cn, timeAgo } from "@/lib/utils";

interface CommandRow {
  id: string;
  type: string;
  params: Record<string, unknown>;
  status: "pending" | "sent" | "delivered" | "failed" | "cancelled";
  result: string | null;
  createdAt: string;
}
interface Template {
  id: string;
  name: string;
  protocol: string | null;
  type: string;
  params: Record<string, string | number | boolean>;
}

const STATUS: Record<CommandRow["status"], { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  pending: { label: "En cola", variant: "secondary" },
  sent: { label: "Enviado", variant: "warning" },
  delivered: { label: "Confirmado", variant: "success" },
  failed: { label: "Fallido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

/** Ejemplos de sintaxis por protocolo para el comando personalizado. */
const CUSTOM_EXAMPLES: Record<string, string> = {
  gt06: "Ej.: WHERE#  ·  RELAY,1#  ·  TIMER,30#  ·  SOS,A,5551234567#",
  teltonika: "Ej.: getgps  ·  getver  ·  setdigout 1  ·  getstatus",
  gps103: "Ej.: **,imei:IMEI,B;  ·  **,imei:IMEI,C,30s;",
  tk103: "Ej.: (ID AP00) — consulta el manual del equipo",
  h02: "Ej.: *HQ,ID,D1,HHMMSS,30,1# — consulta el manual del equipo",
  meitrack: "Ej.: @@A27,IMEI,A10*CS — consulta el manual del equipo",
};

function delivery(protocol: string) {
  if (protocol === "phone") return "El teléfono lo recibe en su siguiente reporte de ubicación.";
  if (getProtocol(protocol)?.transport === "tcp")
    return "Se entrega al instante si el equipo está conectado; si no, al reconectar (válido 24 h).";
  return "Se reenvía al servidor de protocolos configurado (COMMANDS_WEBHOOK_URL).";
}

export function CommandsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  deviceName: string;
  protocol: string;
}) {
  const available = commandsFor(props.protocol);
  const presets = available.filter((c) => c.type !== "custom");
  const supportsCustom = available.some((c) => c.type === "custom");
  const [tab, setTab] = useState<"presets" | "custom">(presets.length ? "presets" : "custom");
  const [history, setHistory] = useState<CommandRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setHistory(await api<CommandRow[]>(`/api/devices/${props.deviceId}/commands`).catch(() => []));
  }, [props.deviceId]);

  useEffect(() => {
    if (!props.open) return;
    void load();
    api<Template[]>("/api/command-templates").then(setTemplates).catch(() => {});
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [props.open, load]);

  const myTemplates = useMemo(
    () =>
      templates.filter(
        (t) => (!t.protocol || t.protocol === props.protocol) && available.some((c) => c.type === t.type),
      ),
    [templates, props.protocol, available],
  );

  async function send(key: string, type: string, params: Record<string, unknown>) {
    setPending(key);
    setError(null);
    try {
      await api(`/api/devices/${props.deviceId}/commands`, { method: "POST", json: { type, params } });
      await load();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setPending(null);
    }
  }

  async function removeTemplate(id: string) {
    if (!confirm("¿Eliminar este comando predefinido?")) return;
    await api(`/api/command-templates/${id}`, { method: "DELETE" }).catch((err) => setError(err.message));
    setTemplates((t) => t.filter((x) => x.id !== id));
  }

  async function cancel(id: string) {
    await api(`/api/commands/${id}`, { method: "DELETE" }).catch((err) => setError(err.message));
    await load();
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Comandos · {props.deviceName}</DialogTitle>
          <DialogDescription>
            Protocolo <strong>{getProtocol(props.protocol)?.name ?? props.protocol}</strong>. {delivery(props.protocol)}
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            Este protocolo solo envía posiciones y no admite comandos.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  ["presets", `Predefinidos (${presets.length + myTemplates.length})`],
                  ["custom", "Personalizado"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  disabled={k === "custom" && !supportsCustom}
                  onClick={() => setTab(k)}
                  className={cn(
                    "rounded-lg py-2 text-sm font-medium text-muted-foreground transition disabled:opacity-40",
                    tab === k && "bg-white text-violet-700 shadow-sm",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {tab === "presets" ? (
              <div className="max-h-[42svh] space-y-2 overflow-auto pr-1">
                {presets.map((c) => (
                  <PresetRow key={c.type} def={c} busy={pending === c.type} onSend={(p) => send(c.type, c.type, p)} />
                ))}
                {myTemplates.length > 0 && (
                  <p className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Guardados por tu empresa</p>
                )}
                {myTemplates.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {t.type === "custom" ? String(t.params.data ?? "") : getCommand(t.type)?.label}
                        {t.protocol ? ` · solo ${getProtocol(t.protocol)?.name ?? t.protocol}` : ""}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="size-8" title="Eliminar" onClick={() => removeTemplate(t.id)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                    <Button size="sm" disabled={pending === t.id} onClick={() => send(t.id, t.type, t.params)}>
                      {pending === t.id ? <Loader2 className="animate-spin" /> : <Send />} Enviar
                    </Button>
                  </div>
                ))}
                {presets.length === 0 && myTemplates.length === 0 && (
                  <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                    No hay comandos predefinidos para este protocolo. Usa la pestaña Personalizado y guárdalo para
                    tenerlo aquí.
                  </p>
                )}
              </div>
            ) : (
              <CustomCommand
                protocol={props.protocol}
                busy={pending === "custom"}
                onSend={(data) => send("custom", "custom", { data })}
                onSaved={(t) => setTemplates((list) => [...list, t].sort((a, b) => a.name.localeCompare(b.name)))}
                onError={setError}
              />
            )}
          </>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold">Historial</h3>
          <ul className="max-h-48 divide-y overflow-auto rounded-xl border text-sm">
            {history.length === 0 && <li className="p-3 text-muted-foreground">Sin comandos enviados.</li>}
            {history.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {c.type === "custom" ? <span className="font-mono">{String(c.params?.data ?? "")}</span> : getCommand(c.type)?.label ?? c.type}
                  </div>
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

function PresetRow({ def, busy, onSend }: { def: CommandDefinition; busy: boolean; onSend: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const ready = (def.params ?? []).every((p) => (params[p.key] ?? "").trim()) && (!def.dangerous || confirmed);
  return (
    <div className={cn("space-y-2 rounded-xl border p-3", def.dangerous && "border-amber-300 bg-amber-50/50")}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{def.label}</div>
          <div className="text-xs text-muted-foreground">{def.description}</div>
        </div>
        <Button
          size="sm"
          variant={def.dangerous ? "destructive" : "default"}
          disabled={busy || !ready}
          onClick={async () => {
            if (await onSend(params)) {
              setParams({});
              setConfirmed(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Send />} Enviar
        </Button>
      </div>
      {def.params?.map((p) => (
        <Input
          key={p.key}
          className="h-8 bg-white"
          placeholder={p.label}
          type={p.kind === "number" ? "number" : "text"}
          min={p.min}
          max={p.max}
          maxLength={p.maxLength}
          value={params[p.key] ?? ""}
          onChange={(e) => setParams((s) => ({ ...s, [p.key]: e.target.value }))}
        />
      ))}
      {def.dangerous && (
        <label className="flex items-start gap-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="flex-1">Confirmo que el vehículo está detenido en un lugar seguro y que tengo autorización.</span>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="size-4 accent-violet-600" />
        </label>
      )}
    </div>
  );
}

function CustomCommand(props: {
  protocol: string;
  busy: boolean;
  onSend: (data: string) => Promise<boolean>;
  onSaved: (t: Template) => void;
  onError: (msg: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [save, setSave] = useState(false);
  const [name, setName] = useState("");
  const [onlyProtocol, setOnlyProtocol] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    props.onError(null);
    if (save) {
      try {
        const res = await api<{ id: string }>("/api/command-templates", {
          method: "POST",
          json: { name, protocol: onlyProtocol ? props.protocol : null, type: "custom", params: { data: text } },
        });
        props.onSaved({ id: res.id, name, protocol: onlyProtocol ? props.protocol : null, type: "custom", params: { data: text } });
      } catch (err) {
        props.onError((err as Error).message);
        return;
      }
    }
    if (await props.onSend(text)) {
      setText("");
      setSave(false);
      setName("");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="grid gap-2">
        <Label htmlFor="custom-cmd">Comando</Label>
        <textarea
          id="custom-cmd"
          required
          maxLength={200}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-md border border-input bg-white px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder="Escribe el comando con la sintaxis del fabricante"
        />
        <p className="text-xs text-muted-foreground">{CUSTOM_EXAMPLES[props.protocol] ?? "Se envía tal cual al equipo."}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="size-4 accent-violet-600" />
        <BookmarkPlus className="size-4 text-violet-600" /> Guardar como comando predefinido
      </label>
      {save && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <Input required minLength={2} maxLength={60} placeholder="Nombre (p. ej. Cortar corriente)" value={name} onChange={(e) => setName(e.target.value)} className="bg-white" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={onlyProtocol} onChange={(e) => setOnlyProtocol(e.target.checked)} className="size-4 accent-violet-600" />
            Solo para {getProtocol(props.protocol)?.name ?? props.protocol}
          </label>
        </div>
      )}
      <Button type="submit" disabled={props.busy || !text.trim()}>
        {props.busy ? <Loader2 className="animate-spin" /> : <Send />} {save ? "Guardar y enviar" : "Enviar comando"}
      </Button>
    </form>
  );
}
