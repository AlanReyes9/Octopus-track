import "server-only";
import bcrypt from "bcryptjs";
import { and, eq, getDb, memberships, sql, tenants, users, type MembershipRole } from "@octopus/db";

export async function verifyCredentials(email: string, password: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  const [membership] = await db
    .select({ tenantId: memberships.tenantId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .orderBy(memberships.createdAt)
    .limit(1);
  if (!membership) return null;
  return { user, membership };
}

function slugify(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "empresa"
  );
}

/** Alta de una empresa nueva con su usuario propietario. */
export async function registerTenant(input: { company: string; name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return getDb().transaction(async (tx) => {
    const suffix = Math.random().toString(36).slice(2, 7);
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: input.company, slug: `${slugify(input.company)}-${suffix}` })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({ email: input.email.toLowerCase(), name: input.name, passwordHash })
      .returning();
    await tx.insert(memberships).values({ userId: user!.id, tenantId: tenant!.id, role: "owner" });
    return { user: user!, tenant: tenant!, role: "owner" as MembershipRole };
  });
}

export async function listUserTenants(userId: string) {
  return getDb()
    .select({ id: tenants.id, name: tenants.name, role: memberships.role })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.userId, userId))
    .orderBy(tenants.name);
}

export async function getMembership(userId: string, tenantId: string) {
  const [m] = await getDb()
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)))
    .limit(1);
  return m ?? null;
}

export async function dbHealth() {
  const db = getDb();
  const rows = await db.execute<{ postgis: string | null; timescaledb: string | null }>(sql`
    SELECT
      (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis,
      (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb') AS timescaledb
  `);
  return rows[0];
}
