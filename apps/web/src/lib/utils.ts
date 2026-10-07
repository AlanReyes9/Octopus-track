import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
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
