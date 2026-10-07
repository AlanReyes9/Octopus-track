import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Aplica migrations/*.sql en orden, registrándolas en _migrations. */
export async function runMigrations(url: string) {
  const sql = postgres(url, { max: 1, onnotice: (n) => console.log(`[${n.severity}] ${n.message}`) });
  try {
    await sql`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const applied = new Set((await sql<{ name: string }[]>`SELECT name FROM _migrations`).map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const content = await readFile(join(dir, file), "utf8");
      console.log(`→ aplicando ${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      });
    }
    console.log("✓ migraciones al día");
  } finally {
    await sql.end();
  }
}
