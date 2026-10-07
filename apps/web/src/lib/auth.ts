import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { MembershipRole } from "@octopus/db";

export const SESSION_COOKIE = "octopus_session";
const SESSION_TTL_S = 60 * 60 * 24 * 7;

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

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
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
