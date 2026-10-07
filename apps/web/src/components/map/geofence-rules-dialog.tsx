"use client";

import { AlertTriangle, BellRing, LogIn, LogOut, Repeat, Send, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { COMMANDS, getCommand } from "@octopus/telemetry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";
import { cn, timeAgo } from "@/lib/utils";

interface Rule {
  id: string;
  trigger: "enter" | "exit" | "both";
  deviceId: string | null;
  deviceName: string | null;
  action: "notify" | "command";
  commandType: string | null;
  params: Record<string, unknown>;
  enabled: boolean;
  lastFiredAt: string | null;
}
interface Unit {
  id: string;
  name: string;
}

const TRIGGERS = [
  { id: "enter", label: "Al entrar", Icon: LogIn },
  { id: "exit", label: "Al salir", Icon: LogOut },
  { id: "both", label: "Entrar o salir", Icon: Repeat },
] as const;

/** Comandos permitidos en automatizaciones (sin bloqueo de motor). */
const AUTO_COMMANDS = COMMANDS.filter((c) => c.type !== "engineStop");

function describe(rule: Rule) {
  if (rule.action === "notify") return "Enviar notificación push";
  const def = getCommand(rule.commandType ?? "");
  if (rule.commandType === "custom") return `Comando: ${String(rule.params.data ?? "")}`;
  const extra = Object.values(rule.params).join(", ");
  return `Comando: ${def?.label ?? rule.commandType}${extra ? ` (${extra})` : ""}`;
}

export function GeofenceRulesDialog(props: { geofence: { id: string; name: string } | null; onClose: () => void }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [trigger, setTrigger] = useState<Rule["trigger"]>("exit");
  const [deviceId, setDeviceId] = useState("");
  const [action, setAction] = useState<Rule["action"]>("notify");
  const [commandType, setCommandType] = useState("requestPosition");
  const [params, setParams] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const gf = props.geofence;
  const def = getCommand(commandType);

  const load = useCallback(async () => {
    if (!gf) return;
    setRules(await api<Rule[]>(`/api/geofences/${gf.id}/rules`).catch(() => []));
  }, [gf]);

  useEffect(() => {
    if (!gf) return;
    void load();
    api<{ id: string; name: string; vehicleName: string | null }[]>("/api/devices")
      .then((list) => setUnits(list.map((d) => ({ id: d.id, name: d.vehicleName ?? d.name }))))
      .catch(() => {});
  }, [gf, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!gf) return;
    setPending(true);
    setError(null);
    try {
      await api(`/api/geofences/${gf.id}/rules`, {
        method: "POST",
        json: {
          trigger,
          deviceId: deviceId || null,
          action,
          commandType: action === "command" ? commandType : null,
          params: action === "command" ? params : {},
        },
      });
      setParams({});
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function toggle(rule: Rule) {
    await api(`/api/geofence-rules/${rule.id}`, { method: "PATCH", json: { enabled: !rule.enabled } });
    await load();
  }

  async function remove(rule: Rule) {
    if (!confirm("¿Eliminar esta acción?")) return;
    await api(`/api/geofence-rules/${rule.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <Dialog open={!!gf} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5 text-violet-600" /> Acciones · {gf?.name}
          </DialogTitle>
          <DialogDescription>Qué hacer automáticamente cuando una unidad entra o sale de esta geocerca.</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {rules.length === 0 && (
            <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Sin acciones. Crea la primera abajo.
            </li>
          )}
          {rules.map((r) => {
            const T = TRIGGERS.find((t) => t.id === r.trigger)!;
            return (
              <li key={r.id} className={cn("flex items-center gap-3 rounded-xl border p-3", !r.enabled && "opacity-60")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  {r.action === "notify" ? <BellRing className="size-4" /> : <Send className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    <Badge variant="outline">
                      <T.Icon className="size-3" /> {T.label}
                    </Badge>
                    <span className="truncate">{describe(r)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.deviceName ?? "Cualquier unidad"} · {r.lastFiredAt ? `última vez ${timeAgo(r.lastFiredAt)}` : "aún no se ha ejecutado"}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" className="size-4 accent-violet-600" checked={r.enabled} onChange={() => toggle(r)} />
                  Activa
                </label>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => remove(r)} title="Eliminar">
                  <Trash2 className="text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>

        <form onSubmit={add} className="grid gap-4 rounded-xl border bg-muted/30 p-4">
          <div className="grid gap-2">
            <Label>Cuándo</Label>
            <div className="grid grid-cols-3 gap-2">
              {TRIGGERS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTrigger(id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border bg-white py-2 text-sm",
                    trigger === id && "border-violet-500 bg-violet-50 font-semibold text-violet-700 ring-1 ring-violet-500",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="r-unit">Unidad</Label>
              <NativeSelect id="r-unit" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="bg-white">
                <option value="">Cualquier unidad</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-action">Acción</Label>
              <NativeSelect id="r-action" value={action} onChange={(e) => setAction(e.target.value as Rule["action"])} className="bg-white">
                <option value="notify">Enviar notificación push</option>
                <option value="command">Enviar comando a la unidad</option>
              </NativeSelect>
            </div>
          </div>
          {action === "command" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="r-cmd">Comando</Label>
                <NativeSelect
                  id="r-cmd"
                  value={commandType}
                  onChange={(e) => {
                    setCommandType(e.target.value);
                    setParams({});
                  }}
                  className="bg-white"
                >
                  {AUTO_COMMANDS.map((c) => (
                    <option key={c.type} value={c.type}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{def?.description}</p>
              </div>
              {def?.params?.map((p) => (
                <Input
                  key={p.key}
                  required
                  className="bg-white"
                  placeholder={p.label}
                  type={p.kind === "number" ? "number" : "text"}
                  min={p.min}
                  max={p.max}
                  maxLength={p.maxLength}
                  value={params[p.key] ?? ""}
                  onChange={(e) => setParams((s) => ({ ...s, [p.key]: e.target.value }))}
                />
              ))}
              <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                El comando se envía a la unidad que provoca el evento, si su protocolo lo admite. Por seguridad el bloqueo
                de motor no puede automatizarse; no uses comandos personalizados que corten la marcha de un vehículo en
                movimiento.
              </p>
            </>
          )}
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            <Zap /> Añadir acción
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
