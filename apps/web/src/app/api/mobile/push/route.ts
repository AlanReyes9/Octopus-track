import { z } from "zod";
import { getDb, sql } from "@octopus/db";
import { json, parseBody, withAuth } from "@/lib/api";

const schema = z.object({ token: z.string().min(20).max(4096), platform: z.literal("android").default("android") });

/** Registra el token FCM de este teléfono para el usuario actual. */
export const POST = withAuth(async (req, { session }) => {
  const { token, platform } = await parseBody(req, schema);
  await getDb().execute(sql`
    INSERT INTO mobile_push_tokens (user_id, tenant_id, token, platform)
    VALUES (${session.userId}, ${session.tenantId}, ${token}, ${platform})
    ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, tenant_id = EXCLUDED.tenant_id, updated_at = now()
  `);
  return json({ ok: true }, 201);
});

export const DELETE = withAuth(async (req, { session }) => {
  const { token } = await parseBody(req, z.object({ token: z.string().max(4096) }));
  await getDb().execute(sql`DELETE FROM mobile_push_tokens WHERE token = ${token} AND user_id = ${session.userId}`);
  return json({ ok: true });
});
