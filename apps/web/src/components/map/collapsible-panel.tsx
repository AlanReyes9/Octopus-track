"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel lateral retraíble sobre el mapa. En pantallas chicas se abre como un
 * cajón superpuesto (con fondo oscurecido) para que el mapa se vea completo
 * cuando está cerrado; en pantallas grandes queda fijo junto al mapa pero
 * también se puede retraer para ganar espacio. Un único botón flotante
 * alterna entre abrir y cerrar.
 */
export function CollapsibleMapPanel({
  children,
  contentClassName = "space-y-4 p-4 pt-0",
}: {
  children: ReactNode;
  /** Clase del contenedor interno; por defecto añade el padding estándar del panel. */
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  // Abierto por defecto en pantallas grandes (hay espacio de sobra).
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setOpen(true);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="absolute top-3 left-3 z-30 flex size-11 items-center justify-center rounded-full border bg-white shadow-lg"
        aria-label={open ? "Ocultar panel" : "Mostrar panel"}
        aria-expanded={open}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
          <section className="fixed inset-y-0 left-0 z-20 flex w-[88vw] max-w-sm flex-col overflow-auto bg-white pt-16 shadow-2xl lg:absolute lg:w-[340px] lg:max-w-none lg:border-r lg:shadow-none">
            <div className={cn(contentClassName)}>{children}</div>
          </section>
        </>
      )}
    </>
  );
}
