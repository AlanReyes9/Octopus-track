import "server-only";
import { getDb, sql } from "@octopus/db";
import { HttpError } from "@/lib/api";

export interface RuleInput {
  trigger: "enter" | "exit" | "both";
  deviceId: string | null;
  action: "notify" | "command";
  commandType: string | null;
  params: Record<string, string | number | boolean>;
}

export async function listRules(tenantId: string, geofenceId: string) {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    SELECT r.id, r.trigger, r.device_id, r.action, r.command_type, r.params, r.enabled, r.last_fired_at,
           COALESCE(v.name, d.name) AS device_name
    FROM geofence_rules r
    LEFT JOIN devices d ON d.id = r.device_id
    LEFT JOIN vehicles v ON v.device_id = d.id
    WHERE r.tenant_id = ${tenantId} AND r.geofence_id = ${geofenceId}
    ORDER BY r.created_at
  `);
  return rows.map((r) => ({
    id: r.id as string,
    trigger: r.trigger as RuleInput["trigger"],
    deviceId: (r.device_id as string) ?? null,
    deviceName: (r.device_name as string) ?? null,
    action: r.action as RuleInput["action"],
    commandType: (r.command_type as string) ?? null,
    params: (r.params as Record<string, unknown>) ?? {},
    enabled: r.enabled as boolean,
    lastFiredAt: r.last_fired_at ? new Date(r.last_fired_at as string).toISOString() : null,
  }));
}

export async function createRule(tenantId: string, userId: string, geofenceId: string, input: RuleInput) {
  const db = getDb();
  const [gf] = await db.execute(sql`SELECT 1 FROM geofences WHERE id = ${geofenceId} AND tenant_id = ${tenantId}`);
  if (!gf) throw new HttpError(404, "Geocerca no encontrada");
  if (input.deviceId) {
    const [d] = await db.execute(sql`SELECT 1 FROM devices WHERE id = ${input.deviceId} AND tenant_id = ${tenantId}`);
    if (!d) throw new HttpError(404, "Unidad no encontrada");
  }
  const rows = await db.execute<{ id: string }>(sql`
    INSERT INTO geofence_rules (tenant_id, geofence_id, trigger, device_id, action, command_type, params, created_by)
    VALUES (${tenantId}, ${geofenceId}, ${input.trigger}, ${input.deviceId}, ${input.action},
            ${input.action === "command" ? input.commandType : null}, ${JSON.stringify(input.params)}::jsonb, ${userId})
    RETURNING id
  `);
  return rows[0]!;
}

export async function setRuleEnabled(tenantId: string, id: string, enabled: boolean) {
  const rows = await getDb().execute(sql`
    UPDATE geofence_rules SET enabled = ${enabled} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
  `);
  return rows.length > 0;
}

export async function deleteRule(tenantId: string, id: string) {
  const rows = await getDb().execute(sql`DELETE FROM geofence_rules WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id`);
  return rows.length > 0;
}
