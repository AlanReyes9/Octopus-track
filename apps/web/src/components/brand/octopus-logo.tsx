import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Logotipo de Octopus Track: pulpo cuya cabeza es un marcador de ubicación.
 * Diseño vectorial original del proyecto.
 */
export function OctopusMark({
  className,
  mono = false,
  light = false,
}: {
  className?: string;
  mono?: boolean;
  /** Variante clara para fondos morados oscuros. */
  light?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const stops = light ? ["#ffffff", "#ede9fe", "#c4b5fd"] : ["#a78bfa", "#7c3aed", "#5b21b6"];
  const fill = mono ? "currentColor" : `url(#og-${id})`;
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} role="img" aria-label="Octopus Track">
      {!mono && (
        <defs>
          <linearGradient id={`og-${id}`} x1="10" y1="4" x2="54" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor={stops[0]} />
            <stop offset="0.55" stopColor={stops[1]} />
            <stop offset="1" stopColor={stops[2]} />
          </linearGradient>
        </defs>
      )}
      {/* tentáculos */}
      <g fill="none" stroke={fill} strokeWidth="4.6" strokeLinecap="round">
        <path d="M21 35c-3.5 4.5-8.5 6.5-12.5 4.2" />
        <path d="M25.5 37.5c-.6 6.2-3.6 10.6-8.3 12.4" />
        <path d="M32 38.5v13.2c0 2.9 2.2 4.6 4.6 3.6" />
        <path d="M38.5 37.5c.6 6.2 3.6 10.6 8.3 12.4" />
        <path d="M43 35c3.5 4.5 8.5 6.5 12.5 4.2" />
      </g>
      {/* cabeza / marcador */}
      <path
        d="M32 5C22 5 14 12.7 14 22.6c0 6.6 3.4 11.3 7 14.4.9.8 2 1.2 3.2 1.2h15.6c1.2 0 2.3-.4 3.2-1.2 3.6-3.1 7-7.8 7-14.4C50 12.7 42 5 32 5Z"
        fill={fill}
      />
      {/* ojos */}
      <circle cx="25.8" cy="22" r="4" fill="#fff" />
      <circle cx="38.2" cy="22" r="4" fill="#fff" />
      <circle cx="26.6" cy="22.8" r="1.9" fill="#1e1036" />
      <circle cx="39" cy="22.8" r="1.9" fill="#1e1036" />
    </svg>
  );
}

export function OctopusLogo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <OctopusMark className="size-9" light={inverted} />
      <span className="text-lg leading-none">
        Octopus<span className={inverted ? "text-violet-300" : "text-primary"}>Track</span>
      </span>
    </span>
  );
}
