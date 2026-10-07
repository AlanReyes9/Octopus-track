import { CheckCircle2, Network, Radio, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { commandsFor, GATEWAY_PROTOCOLS, NATIVE_PROTOCOLS } from "@octopus/telemetry";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireManager } from "@/lib/guards";

export const metadata: Metadata = { title: "Protocolos" };

/** Ejemplos de SMS de configuración habituales (verifica el manual de tu modelo). */
const SMS: Record<string, string> = {
  gt06: "SERVER,0,{host},{port},0#",
  gps103: "adminip123456 {host} {port}",
  h02: "8040000 {host} {port}",
  tk103: "adminip123456 {host} {port}",
};

export default async function ProtocolsPage() {
  await requireManager();
  const host = process.env.NEXT_PUBLIC_INGEST_HOST || "tu-servidor-de-ingesta";
  const port = process.env.NEXT_PUBLIC_INGEST_TCP_PORT || "5023";
  const fill = (t: string) => t.replace("{host}", host).replace("{port}", port);
  const tcp = NATIVE_PROTOCOLS.filter((p) => p.transport === "tcp");

  return (
    <>
      <PageHeader
        title="Protocolos compatibles"
        description="Octopus Track reconoce automáticamente el protocolo de cada rastreador al conectarse."
      />
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-5 text-violet-600" /> Conexión directa (decodificación nativa)
              </CardTitle>
              <CardDescription>
                Todos comparten el puerto <strong>{port}</strong>: el servidor identifica el protocolo por los primeros
                bytes y lo asigna al dispositivo en la web.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {tcp.map((p) => (
                <div key={p.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{p.name}</div>
                    <Badge variant="success">
                      <CheckCircle2 className="size-3" /> Nativo
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.devices}</p>
                  <p className="mt-2 text-xs">
                    <span className="font-medium">Comandos:</span>{" "}
                    {commandsFor(p.id).map((c) => c.label).join(", ") || "solo posiciones"}
                  </p>
                  {SMS[p.id] && (
                    <p className="mt-2 rounded-md bg-muted px-2 py-1 font-mono text-[11px]">SMS: {fill(SMS[p.id]!)}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="size-5 text-violet-600" /> Vía servidor de protocolos (gateway)
              </CardTitle>
              <CardDescription>
                Para el resto de marcas (cientos de protocolos), un servidor de protocolos de código abierto recibe los
                equipos y reenvía las posiciones a <code>/api/ingest/gateway</code>. Ver <code>deploy/protocol-gateway</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {GATEWAY_PROTOCOLS.map((p) => (
                <span key={p.id} className="rounded-lg border bg-white px-2.5 py-1.5 text-xs" title={p.devices}>
                  <span className="font-semibold">{p.name}</span> <span className="text-muted-foreground">· {p.devices}</span>
                </span>
              ))}
              <span className="rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">y muchos más…</span>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurar un rastreador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Inserta una SIM con datos y configura el APN de tu operador.</li>
                <li>
                  Apunta el equipo al servidor <code className="rounded bg-muted px-1">{host}</code> puerto{" "}
                  <code className="rounded bg-muted px-1">{port}</code> (TCP).
                </li>
                <li>Regístralo en <strong>Dispositivos</strong> con su IMEI: si ya se conectó, la web detecta el protocolo.</li>
                <li>Asígnalo a un vehículo para verlo en el mapa.</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                Los SMS de ejemplo son los más comunes para cada familia; la contraseña y sintaxis exacta dependen del
                modelo y firmware. Consulta el manual del fabricante.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="size-5 text-violet-600" /> Teléfonos y apps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Android / iPhone:</strong> crea un dispositivo tipo Teléfono y comparte
                el enlace de vinculación (requiere consentimiento).
              </p>
              <p>
                <strong className="text-foreground">Apps con protocolo OsmAnd:</strong> URL del servidor{" "}
                <code>/api/ingest/osmand?token=…</code> e identificador = IMEI registrado.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
