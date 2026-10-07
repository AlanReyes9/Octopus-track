import Link from "next/link";
import { OctopusLogo } from "@/components/brand/octopus-logo";
import { LEGAL } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <OctopusLogo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Rastreo GPS de flotas y teléfonos con consentimiento, en tiempo real.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          <Link href="/legal/privacidad" className="text-muted-foreground hover:text-primary">Aviso de privacidad</Link>
          <Link href="/legal/terminos" className="text-muted-foreground hover:text-primary">Términos y condiciones</Link>
          <Link href="/legal/cookies" className="text-muted-foreground hover:text-primary">Política de cookies</Link>
          <Link href="/legal/licencias" className="text-muted-foreground hover:text-primary">Licencias y créditos</Link>
        </nav>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {LEGAL.company}. Todos los derechos reservados. Datos cartográficos © colaboradores de
        OpenStreetMap.
      </div>
    </footer>
  );
}
