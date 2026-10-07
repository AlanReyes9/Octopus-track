import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { OctopusLogo, OctopusMark } from "@/components/brand/octopus-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="brand-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col">
        <div className="grid-pattern absolute inset-0" />
        <Link href="/" className="relative">
          <OctopusLogo inverted />
        </Link>
        <div className="relative my-auto max-w-md space-y-6">
          <OctopusMark light className="size-20 drop-shadow-xl" />
          <h1 className="text-3xl leading-tight font-bold">Monitorea vehículos y teléfonos en tiempo real.</h1>
          <ul className="space-y-3 text-violet-100">
            {["Mapa en vivo y seguimiento", "Historial, geocercas y alertas", "Comandos remotos seguros"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-violet-300" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-violet-200/70">
          <Link href="/legal/privacidad" className="hover:underline">Privacidad</Link> ·{" "}
          <Link href="/legal/terminos" className="hover:underline">Términos</Link>
        </p>
      </section>
      <section className="flex flex-col items-center justify-center gap-8 bg-white p-6">
        <Link href="/" className="lg:hidden">
          <OctopusLogo />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
