import { isDbConfigured } from "@octopus/db";
import { json } from "@/lib/api";
import { dbHealth } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) return json({ ok: false, database: "not_configured" }, 503);
  try {
    const ext = await dbHealth();
    return json({ ok: true, database: "up", extensions: ext });
  } catch (err) {
    return json({ ok: false, database: "down", error: (err as Error).message }, 503);
  }
}
