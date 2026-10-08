import "server-only";
import { getDb, sql, type MembershipRole } from "@octopus/db";
import { signMobileToken, type Session } from "@/lib/auth";
import { listUserTenants } from "./auth";

export interface MobileUser {
  id: string;
  name: string;
  email: string;
  role: MembershipRole;
  tenantId: string;
  tenantName: string;
  mustChangePassword: boolean;
}

/** Datos que la app necesita tras iniciar sesión o abrirse con un token guardado. */
export async function mobileProfile(session: Session): Promise<{ user: MobileUser; tenants: { id: string; name: string; role: MembershipRole }[] }> {
  const rows = await getDb().execute<{ email: string; name: string; must_change_password: boolean }>(sql`
    SELECT email, name, must_change_password FROM users WHERE id = ${session.userId}
  `);
  const u = rows[0]!;
  const tenants = await listUserTenants(session.userId);
  return {
    user: {
      id: session.userId,
      name: u.name,
      email: u.email,
      role: session.role,
      tenantId: session.tenantId,
      tenantName: tenants.find((t) => t.id === session.tenantId)?.name ?? "",
      mustChangePassword: u.must_change_password,
    },
    tenants,
  };
}

export async function issueMobileToken(session: Session) {
  const rows = await getDb().execute<{ password_hash: string }>(sql`SELECT password_hash FROM users WHERE id = ${session.userId}`);
  return signMobileToken(session, rows[0]!.password_hash);
}
