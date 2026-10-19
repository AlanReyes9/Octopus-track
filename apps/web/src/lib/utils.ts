import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

/** "2 h 15 min", "45 min", "30 s" — para la duración de una parada. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "nunca";
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return `hace ${Math.max(s, 0)} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

/** Online si reportó en los últimos 5 minutos. */
export function isOnline(lastSeen: string | Date | null | undefined): boolean {
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 5 * 60_000;
}
