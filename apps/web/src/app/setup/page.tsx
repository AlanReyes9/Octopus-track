import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const OPTIONAL = [
  ["INGEST_TOKEN", "Habilita la recepción de posiciones en /api/ingest/gateway y /api/ingest/osmand"],
  ["REDIS_URL", "Publica eventos en Redis Pub/Sub para el gateway WebSocket"],
  ["REALTIME_JWT_SECRET", "Firma los tokens del gateway WebSocket"],
  ["NEXT_PUBLIC_REALTIME_URL", "URL wss:// del gateway (si falta, la UI usa polling)"],
] as const;

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Configuración pendiente</CardTitle>
          <CardDescription>
            Octopus Track necesita PostgreSQL con PostGIS. En Vercel: Storage → crea una base Neon y conéctala al
            proyecto; las migraciones se aplican solas en el siguiente despliegue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-2">
            {["AUTH_SECRET", "DATABASE_URL"].map((k) => (
              <li key={k} className="flex items-center gap-2 font-mono text-sm">
                {!missingEnv().includes(k) ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                {k}
              </li>
            ))}
          </ul>
          <div>
            <p className="mb-2 text-sm font-medium">Opcionales</p>
            <ul className="space-y-2 text-sm">
              {OPTIONAL.map(([k, desc]) => (
                <li key={k} className="flex items-start gap-2">
                  {process.env[k] ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <span className="mt-0.5 size-4 shrink-0 rounded-full border" />
                  )}
                  <span>
                    <span className="font-mono">{k}</span> — <span className="text-muted-foreground">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
