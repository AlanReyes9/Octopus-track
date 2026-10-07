import {
  Bell,
  Car,
  History,
  Lock,
  MapPinned,
  Navigation,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import Link from "next/link";
import { OctopusLogo, OctopusMark } from "@/components/brand/octopus-logo";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Radio, title: "Mapa en vivo", text: "Posición, velocidad, rumbo y encendido de cada unidad al instante." },
  { icon: Smartphone, title: "Teléfonos Android e iOS", text: "Localiza teléfonos desde el navegador, sin instalar apps y con consentimiento." },
  { icon: History, title: "Historial de rutas", text: "Reproduce recorridos con distancia, velocidad máxima y media." },
  { icon: MapPinned, title: "Geocercas", text: "Dibuja zonas en el mapa y recibe alertas de entrada y salida." },
  { icon: Send, title: "Comandos remotos", text: "Solicita posición, cambia el intervalo o bloquea el motor con seguridad." },
  { icon: Users, title: "Usuarios cliente", text: "Da acceso de solo lectura a tus clientes, limitado a sus unidades." },
];

export default async function Home() {
  const configured = missingEnv().length === 0;
  const session = configured ? await getSession() : null;

  return (
    <div className="flex min-h-svh flex-col bg-white">
      {/* Navegación */}
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-white">
          <OctopusLogo inverted />
          <div className="flex items-center gap-3">
            {session ? (
              <Button asChild className="bg-white text-violet-700 hover:bg-violet-50">
                <Link href="/dashboard">Ir al panel</Link>
              </Button>
            ) : (
              <Button asChild className="bg-white text-violet-700 hover:bg-violet-50">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="brand-gradient relative overflow-hidden text-white">
        <div className="grid-pattern absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pt-32 pb-20 lg:grid-cols-2 lg:pt-40 lg:pb-28">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <ShieldCheck className="size-3.5" /> Rastreo con privacidad por diseño
            </span>
            <h1 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl">
              Toda tu flota, <span className="text-violet-300">en tiempo real</span>, en un solo lugar.
            </h1>
            <p className="max-w-lg text-lg text-violet-100/90">
              Octopus Track une rastreadores GPS y teléfonos en un panel moderno: mapa en vivo, historial,
              geocercas y comandos remotos para tu empresa y tus clientes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-violet-700 hover:bg-violet-50">
                <Link href={session ? "/dashboard" : "/login"}>{session ? "Abrir panel" : "Acceder a la plataforma"}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
                <Link href="#funciones">Ver funciones</Link>
              </Button>
            </div>
          </div>

          {/* Vista previa ilustrativa (maqueta en HTML/CSS) */}
          <div className="relative hidden lg:block" aria-hidden>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur">
              <div className="overflow-hidden rounded-xl bg-white text-slate-800">
                <div className="flex items-center gap-2 border-b px-4 py-2.5">
                  <OctopusMark className="size-5" />
                  <span className="text-sm font-semibold">Mapa en vivo</span>
                  <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> En vivo
                  </span>
                </div>
                <div className="grid grid-cols-[150px_1fr]">
                  <div className="space-y-2 border-r p-3">
                    {[
                      ["Camión 01", "48 km/h", "#7c3aed"],
                      ["Furgoneta 02", "Detenido", "#0ea5e9"],
                      ["Ana · iPhone", "12 km/h", "#db2777"],
                    ].map(([n, s, c]) => (
                      <div key={n} className="rounded-lg border p-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="size-2 rounded-full" style={{ background: c }} />
                          {n}
                        </div>
                        <div className="text-[11px] text-slate-500">{s}</div>
                      </div>
                    ))}
                  </div>
                  <div className="relative h-64 bg-[#f4f2f8]">
                    <svg viewBox="0 0 300 260" className="absolute inset-0 size-full">
                      <path d="M0 70 H300 M0 170 H300 M90 0 V260 M210 0 V260" stroke="#e3dfee" strokeWidth="10" />
                      <path d="M0 120 C80 110 120 190 300 150" stroke="#ece8f5" strokeWidth="14" fill="none" />
                      <rect x="120" y="40" width="130" height="90" rx="8" fill="#7c3aed" fillOpacity=".1" stroke="#7c3aed" strokeDasharray="4 3" />
                      <path d="M30 220 C70 180 110 200 150 150 S230 90 260 70" stroke="#7c3aed" strokeWidth="4" fill="none" strokeLinecap="round" />
                      <circle cx="260" cy="70" r="9" fill="#7c3aed" stroke="#fff" strokeWidth="3" />
                      <circle cx="95" cy="185" r="8" fill="#0ea5e9" stroke="#fff" strokeWidth="3" />
                      <circle cx="200" cy="200" r="8" fill="#db2777" stroke="#fff" strokeWidth="3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Todo lo que necesitas para monitorear</h2>
          <p className="mt-3 text-muted-foreground">Diseñado para empresas de transporte, reparto, servicios en campo y seguridad.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="group rounded-2xl border bg-white p-6 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100">
              <span className="flex size-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacidad */}
      <section className="bg-violet-50/60">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Localización de teléfonos, siempre con consentimiento</h2>
            <p className="text-muted-foreground">
              La persona recibe un enlace, ve qué empresa verá su ubicación y decide si acepta. Puede dejar de compartir
              cuando quiera con un solo botón. Cada aceptación y revocación queda registrada.
            </p>
            <ul className="space-y-2 text-sm">
              {[
                "Sin apps ocultas ni rastreo en segundo plano sin aviso",
                "Indicador visible mientras se comparte la ubicación",
                `Datos de ubicación eliminados automáticamente a los 180 días`,
                "Aislamiento total de datos entre empresas",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Lock className="mt-0.5 size-4 shrink-0 text-violet-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              { icon: Car, n: "1", t: "Registra tus unidades", d: "Rastreadores GPS o teléfonos." },
              { icon: Navigation, n: "2", t: "Vincula y comparte", d: "Cada equipo empieza a reportar." },
              { icon: Bell, n: "3", t: "Monitorea y actúa", d: "Alertas, historial y comandos." },
            ].map(({ icon: Icon, n, t, d }) => (
              <div key={n} className="rounded-2xl border bg-white p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                  <span className="flex size-6 items-center justify-center rounded-full bg-violet-600 text-xs text-white">{n}</span>
                  <Icon className="size-4" />
                </div>
                <div className="mt-3 font-semibold">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
