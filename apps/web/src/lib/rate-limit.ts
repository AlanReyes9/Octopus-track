import "server-only";

/**
 * Limitador de intentos en memoria (por instancia). En serverless es de mejor
 * esfuerzo: frena la fuerza bruta desde una misma instancia caliente.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 8;

export function loginKey(email: string, ip: string | null) {
  return `${email.toLowerCase()}|${ip ?? "?"}`;
}

/** Segundos de espera si la clave está bloqueada; 0 si puede intentar. */
export function lockedFor(key: string): number {
  const a = attempts.get(key);
  if (!a || a.resetAt < Date.now()) return 0;
  return a.count >= MAX_FAILURES ? Math.ceil((a.resetAt - Date.now()) / 1000) : 0;
}

export function recordFailure(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else a.count++;
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
}

export function recordSuccess(key: string) {
  attempts.delete(key);
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");
