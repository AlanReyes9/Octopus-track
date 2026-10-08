import { getDb, sql } from "@octopus/db";
import { json } from "@/lib/api";
import { checkConnectivity } from "@/lib/ingest";

export const dynamic = "force-dynamic";

/**
 * Mantenimiento diario (Vercel Cron, ver vercel.json): crea las particiones
 * de los próximos días y aplica la retención de datos de ubicación.
 * Vercel envía `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "No autorizado" }, 401);
  }
  const db = getDb();
  const results: Record<string, string> = {};
  for (const [name, query] of [
    ["partitions", sql`SELECT octopus_maintain_partitions()`],
    ["retention", sql`SELECT octopus_apply_retention()`],
    ["pending_devices", sql`DELETE FROM pending_devices WHERE last_seen < now() - interval '30 days'`],
  ] as const) {
    try {
      await db.execute(query);
      results[name] = "ok";
    } catch (err) {
      results[name] = (err as { cause?: { message?: string } }).cause?.message ?? (err as Error).message;
    }
  }
  try {
    results.connectivity = `${await checkConnectivity()} evento(s)`;
  } catch (err) {
    results.connectivity = (err as { cause?: { message?: string } }).cause?.message ?? (err as Error).message;
  }
  return json({ ok: true, results });
}
