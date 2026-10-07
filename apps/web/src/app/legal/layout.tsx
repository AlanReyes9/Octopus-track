import Link from "next/link";
import { OctopusLogo } from "@/components/brand/octopus-logo";
import { SiteFooter } from "@/components/site/site-footer";
import { isLegalConfigured, LEGAL } from "@/lib/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/">
            <OctopusLogo />
          </Link>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Iniciar sesión
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {!isLegalConfigured() && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Los datos del responsable aparecen entre corchetes porque aún no se han configurado
            (NEXT_PUBLIC_LEGAL_NAME, NEXT_PUBLIC_LEGAL_ADDRESS, NEXT_PUBLIC_LEGAL_EMAIL).
          </div>
        )}
        <article className="legal rounded-2xl border bg-white p-8 shadow-sm md:p-12">{children}</article>
        <p className="mt-4 text-center text-xs text-muted-foreground">Última actualización: {LEGAL.updatedAt}</p>
      </main>
      <SiteFooter />
    </div>
  );
}
