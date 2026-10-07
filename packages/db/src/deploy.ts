/**
 * Paso de despliegue (se ejecuta antes de `next build` en Vercel):
 *  1. Aplica migraciones si hay URL directa (p. ej. Neon en Vercel).
 *  2. Crea la empresa y el propietario inicial si la base está vacía
 *     (BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD).
 * Sin URL de migración no hace nada (p. ej. CI o bases gestionadas aparte).
 */
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { migrationUrl } from "./client";
import { runMigrations } from "./migrator";

async function main() {
  const url = migrationUrl();
  if (!url) {
    console.log("[db:deploy] sin URL de migración: se omite");
    return;
  }
  await runMigrations(url);

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  const sql = postgres(url, { max: 1 });
  try {
    const [row] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM users`;
    if ((row?.count ?? 0) > 0) {
      console.log("[db:deploy] ya existen usuarios: no se crea el administrador inicial");
      return;
    }
    const company = process.env.BOOTSTRAP_COMPANY || "Octopus Track";
    const hash = await bcrypt.hash(password, 10);
    await sql.begin(async (tx) => {
      const [tenant] = await tx<{ id: string }[]>`
        INSERT INTO tenants (name, slug) VALUES (${company}, ${"principal"}) RETURNING id`;
      const [user] = await tx<{ id: string }[]>`
        INSERT INTO users (email, name, password_hash, must_change_password, terms_accepted_at)
        VALUES (${email}, ${"Administrador"}, ${hash}, true, now()) RETURNING id`;
      await tx`INSERT INTO memberships (user_id, tenant_id, role) VALUES (${user!.id}, ${tenant!.id}, 'owner')`;
    });
    console.log(`[db:deploy] administrador inicial creado: ${email}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[db:deploy]", err);
  process.exit(1);
});
