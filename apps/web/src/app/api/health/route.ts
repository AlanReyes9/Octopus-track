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
    // drizzle envuelve el error del driver en `cause` (p. ej. credenciales o host).
    const cause = (err as { cause?: { message?: string } }).cause?.message;
    return json({ ok: false, database: "down", error: cause ?? (err as Error).message.split("\n")[0] }, 503);
  }
}
