"use client";

import { BellOff, BellRing, Send, Share } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePush } from "@/hooks/use-push";

export function PushCard() {
  const { state, enable, disable, test } = usePush();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Card className="max-w-md" id="notificaciones">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-5 text-violet-600" /> Notificaciones push
        </CardTitle>
        <CardDescription>
          Recibe en este dispositivo las alertas de geocerca configuradas, aunque no tengas la web abierta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {state === "loading" && <p className="text-muted-foreground">Comprobando…</p>}
        {state === "unsupported" && <p className="text-muted-foreground">Este navegador no admite notificaciones push.</p>}
        {state === "needs-install" && (
          <p className="flex items-start gap-2 rounded-lg bg-violet-50 p-3 text-violet-900">
            <Share className="mt-0.5 size-4 shrink-0" />
            En iPhone/iPad primero instala la app: en Safari pulsa Compartir → «Añadir a pantalla de inicio», ábrela desde
            el icono y activa aquí las notificaciones.
          </p>
        )}
        {state === "unconfigured" && (
          <p className="text-muted-foreground">El administrador aún no ha configurado las claves de notificación (VAPID).</p>
        )}
        {state === "denied" && (
          <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
            Bloqueaste las notificaciones para este sitio. Permítelas en los ajustes del navegador y recarga.
          </p>
        )}
        {state === "off" && (
          <Button onClick={() => enable().catch((e) => setMsg(String(e)))} className="w-full">
            <BellRing /> Activar notificaciones
          </Button>
        )}
        {state === "on" && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const r = await test().catch((e) => ({ sent: -1, e }));
                setMsg(r.sent > 0 ? "Notificación de prueba enviada." : "No se pudo enviar la prueba.");
              }}
            >
              <Send /> Enviar prueba
            </Button>
            <Button variant="ghost" onClick={disable}>
              <BellOff /> Desactivar
            </Button>
          </div>
        )}
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}

/** Aviso compacto para el mapa cuando las notificaciones están desactivadas. */
export function PushBanner() {
  const { state, enable } = usePush();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("octopus_push_banner") === "hidden";
    } catch {
      return false;
    }
  });
  if (hidden || state !== "off") return null;
  return (
    <div className="flex items-center gap-2 border-b bg-violet-50 px-4 py-2 text-xs text-violet-900">
      <BellRing className="size-3.5 shrink-0" />
      <span className="flex-1">Activa las notificaciones para recibir alertas de geocerca al instante.</span>
      <button className="font-semibold text-violet-700 hover:underline" onClick={() => enable()}>
        Activar
      </button>
      <button
        className="text-violet-500 hover:underline"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem("octopus_push_banner", "hidden");
          } catch {}
        }}
      >
        Ahora no
      </button>
    </div>
  );
}
