/**
 * Aplica las migraciones. Uso: DATABASE_URL=... pnpm db:migrate
 */
import { databaseUrl, migrationUrl } from "./client";
import { runMigrations } from "./migrator";

const url = migrationUrl() ?? databaseUrl();
if (!url) {
  console.error("No hay URL de base de datos");
  process.exit(1);
}
runMigrations(url).catch((err) => {
  console.error(err);
  process.exit(1);
});
