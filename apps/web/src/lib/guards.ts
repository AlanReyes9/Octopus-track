import "server-only";
import { redirect } from "next/navigation";
import { canManage, getSession, type Session } from "./auth";

/** Páginas de administración: los usuarios cliente vuelven al mapa. */
export async function requireManager(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManage(session.role)) redirect("/dashboard");
  return session;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
