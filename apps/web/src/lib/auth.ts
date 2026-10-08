import "server-only";
import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { getDb, sql, type MembershipRole } from "@octopus/db";

export const SESSION_COOKIE = "octopus_session";
const SESSION_TTL_S = 60 * 60 * 24 * 7;
/** Los tokens de la app móvil duran más, pero se revalidan en cada petición. */
export const MOBILE_TOKEN_TTL_S = 60 * 60 * 24 * 30;

export interface Session {
  userId: string;
  tenantId: string;
  role: MembershipRole;
  name: string;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET no está definida (mínimo 16 caracteres)");
  return new TextEncoder().encode(s);
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ tid: session.tenantId, role: session.role, name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .setAudience("octopus-web")
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Huella corta del hash de contraseña: cambiarla invalida los tokens móviles. */
export const passwordFingerprint = (passwordHash: string) =>
  createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);

/** Token Bearer para la app móvil (audiencia distinta de la cookie web). */
export async function signMobileToken(session: Session, passwordHash: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + MOBILE_TOKEN_TTL_S * 1000);
  const token = await new SignJWT({ tid: session.tenantId, pv: passwordFingerprint(passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setAudience("octopus-mobile")
    .sign(secret());
  return { token, expiresAt };
}

/**
 * Sesión desde `Authorization: Bearer`. A diferencia de la cookie, se
 * comprueba en la base de datos que el usuario siga en la empresa, que la
 * contraseña no haya cambiado y se toma el rol vigente.
 */
async function sessionFromBearer(): Promise<Session | null> {
  const auth = (await headers()).get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7).trim(), secret(), { audience: "octopus-mobile" });
    if (typeof payload.sub !== "string" || typeof payload.tid !== "string" || typeof payload.pv !== "string") return null;
    const rows = await getDb().execute<{ name: string; role: MembershipRole; password_hash: string }>(sql`
      SELECT u.name, m.role, u.password_hash
      FROM users u JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ${payload.tid}
      WHERE u.id = ${payload.sub}
    `);
    const row = rows[0];
    if (!row || passwordFingerprint(row.password_hash) !== payload.pv) return null;
    return { userId: payload.sub, tenantId: payload.tid, role: row.role, name: row.name };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return sessionFromBearer();
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "octopus-web" });
    if (typeof payload.sub !== "string" || typeof payload.tid !== "string") return null;
    return {
      userId: payload.sub,
      tenantId: payload.tid,
      role: payload.role as MembershipRole,
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

/** Registro público de empresas (desactivar con ALLOW_SIGNUP=false). */
export const signupEnabled = () => process.env.ALLOW_SIGNUP !== "false";

const RANK: Record<MembershipRole, number> = { viewer: 0, admin: 1, owner: 2 };
export const canManage = (role: MembershipRole) => RANK[role] >= RANK.admin;

/** Token corto para el gateway WebSocket (apps/realtime). */
export async function createRealtimeToken(session: Session, deviceIds: string[] | null): Promise<string | null> {
  const s = process.env.REALTIME_JWT_SECRET;
  if (!s) return null;
  // dids: lista de dispositivos permitidos para usuarios cliente (null = todos).
  return new SignJWT(deviceIds ? { tid: session.tenantId, dids: deviceIds } : { tid: session.tenantId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .setAudience("octopus-realtime")
    .sign(new TextEncoder().encode(s));
}
