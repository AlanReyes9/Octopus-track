import { z } from "zod";
import { getDb, sql } from "@octopus/db";
import { json, parseBody, withAuth } from "@/lib/api";

const schema = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith("https://"), "El endpoint debe ser HTTPS"),
  keys: z.object({ p256dh: z.string().min(80).max(120), auth: z.string().min(16).max(40) }),
});

/** Registra (o reasigna) la suscripción push de este navegador al usuario actual. */
export const POST = withAuth(async (req, { session }) => {
  const { endpoint, keys } = await parseBody(req, schema);
  await getDb().execute(sql`
    INSERT INTO push_subscriptions (user_id, tenant_id, endpoint, p256dh, auth, user_agent)
    VALUES (${session.userId}, ${session.tenantId}, ${endpoint}, ${keys.p256dh}, ${keys.auth},
            ${req.headers.get("user-agent")?.slice(0, 300) ?? null})
    ON CONFLICT (endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id, tenant_id = EXCLUDED.tenant_id,
      p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent
  `);
  return json({ ok: true }, 201);
});

export const DELETE = withAuth(async (req, { session }) => {
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string().max(1000) }));
  await getDb().execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${session.userId}`);
  return json({ ok: true });
});
