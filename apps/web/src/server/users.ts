import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  and,
  eq,
  getDb,
  inArray,
  memberships,
  sql,
  userVehicleAccess,
  users,
  vehicles,
  type MembershipRole,
} from "@octopus/db";
import { HttpError } from "@/lib/api";
import type { Session } from "@/lib/auth";

/** Contraseña temporal legible (sin caracteres ambiguos). */
export function temporaryPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function listTenantUsers(tenantId: string) {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    SELECT u.id, u.name, u.email, m.role, u.must_change_password, u.created_at,
           COALESCE(array_agg(a.vehicle_id) FILTER (WHERE a.vehicle_id IS NOT NULL), '{}') AS vehicle_ids
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN user_vehicle_access a ON a.user_id = u.id AND a.tenant_id = m.tenant_id
    WHERE m.tenant_id = ${tenantId}
    GROUP BY u.id, m.role
    ORDER BY m.role, u.name
  `);
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    role: r.role as MembershipRole,
    mustChangePassword: r.must_change_password as boolean,
    createdAt: new Date(r.created_at as string).toISOString(),
    vehicleIds: (r.vehicle_ids as string[]) ?? [],
  }));
}

async function setVehicleAccess(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], tenantId: string, userId: string, vehicleIds: string[]) {
  await tx.delete(userVehicleAccess).where(and(eq(userVehicleAccess.userId, userId), eq(userVehicleAccess.tenantId, tenantId)));
  if (!vehicleIds.length) return;
  const valid = await tx
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.tenantId, tenantId), inArray(vehicles.id, vehicleIds)));
  if (valid.length !== new Set(vehicleIds).size) throw new HttpError(400, "Vehículo no válido");
  await tx.insert(userVehicleAccess).values(valid.map((v) => ({ userId, vehicleId: v.id, tenantId })));
}

function assertCanAssignRole(session: Session, role: MembershipRole) {
  // Solo el propietario puede crear otros administradores o propietarios.
  if (role !== "viewer" && session.role !== "owner") {
    throw new HttpError(403, "Solo el propietario puede crear administradores");
  }
}

export async function createTenantUser(
  session: Session,
  input: { name: string; email: string; role: MembershipRole; vehicleIds: string[] },
) {
  assertCanAssignRole(session, input.role);
  const password = temporaryPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const email = input.email.toLowerCase();
  const user = await getDb().transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new HttpError(409, "Ya existe un usuario con ese correo");
    const [u] = await tx
      .insert(users)
      .values({ name: input.name, email, passwordHash, mustChangePassword: true })
      .returning({ id: users.id });
    await tx.insert(memberships).values({ userId: u!.id, tenantId: session.tenantId, role: input.role });
    if (input.role === "viewer") await setVehicleAccess(tx, session.tenantId, u!.id, input.vehicleIds);
    return u!;
  });
  return { id: user.id, temporaryPassword: password };
}

async function targetMembership(session: Session, userId: string) {
  const [m] = await getDb()
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, session.tenantId)))
    .limit(1);
  if (!m) throw new HttpError(404, "Usuario no encontrado");
  if (userId === session.userId) throw new HttpError(400, "No puedes modificar tu propia cuenta desde aquí");
  if (m.role === "owner" || (m.role === "admin" && session.role !== "owner")) {
    throw new HttpError(403, "Permisos insuficientes para modificar este usuario");
  }
  return m;
}

export async function updateTenantUser(
  session: Session,
  userId: string,
  input: { name?: string; role?: MembershipRole; vehicleIds?: string[] },
) {
  const current = await targetMembership(session, userId);
  if (input.role) assertCanAssignRole(session, input.role);
  await getDb().transaction(async (tx) => {
    if (input.name) await tx.update(users).set({ name: input.name }).where(eq(users.id, userId));
    if (input.role) {
      await tx
        .update(memberships)
        .set({ role: input.role })
        .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, session.tenantId)));
    }
    const role = input.role ?? current.role;
    if (role !== "viewer") await setVehicleAccess(tx, session.tenantId, userId, []);
    else if (input.vehicleIds) await setVehicleAccess(tx, session.tenantId, userId, input.vehicleIds);
  });
}

export async function resetTenantUserPassword(session: Session, userId: string) {
  await targetMembership(session, userId);
  const password = temporaryPassword();
  await getDb()
    .update(users)
    .set({ passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true })
    .where(eq(users.id, userId));
  return password;
}

/** Quita al usuario de la empresa; si no pertenece a ninguna otra, se elimina. */
export async function removeTenantUser(session: Session, userId: string) {
  await targetMembership(session, userId);
  await getDb().transaction(async (tx) => {
    await tx.delete(memberships).where(and(eq(memberships.userId, userId), eq(memberships.tenantId, session.tenantId)));
    await tx.delete(userVehicleAccess).where(and(eq(userVehicleAccess.userId, userId), eq(userVehicleAccess.tenantId, session.tenantId)));
    await tx.execute(sql`DELETE FROM users WHERE id = ${userId} AND NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = ${userId})`);
  });
}

export async function changeOwnPassword(userId: string, current: string, next: string) {
  const db = getDb();
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u || !(await bcrypt.compare(current, u.hash))) throw new HttpError(400, "La contraseña actual no es correcta");
  if (current === next) throw new HttpError(400, "La nueva contraseña debe ser distinta");
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false })
    .where(eq(users.id, userId));
}

export async function getUserFlags(userId: string) {
  const [u] = await getDb()
    .select({ mustChangePassword: users.mustChangePassword, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? null;
}
