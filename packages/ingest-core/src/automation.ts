import { sql, type Database } from "@octopus/db";
import { commandsFor, getCommand, type TelemetryEvent } from "@octopus/telemetry";
import type { CommandStore } from "./commands";
import type { Notifier } from "./notifications";
import type { DeviceRef, GeofenceTransition } from "./pipeline";

/** Comandos que nunca se ejecutan automáticamente (seguridad vial). */
const BLOCKED_AUTOMATIC = new Set(["engineStop"]);

type RuleRow = {
  id: string;
  geofence_id: string;
  action: "notify" | "command";
  command_type: string | null;
  params: Record<string, unknown>;
};

/**
 * Ejecuta las reglas de geocerca (notificación push o comando) cuando una
 * unidad entra o sale de una zona.
 */
export function createAutomation(deps: { db: Database; commands: CommandStore; notifier: Notifier }) {
  const { db, commands, notifier } = deps;

  return async function onGeofenceTransitions(device: DeviceRef, transitions: GeofenceTransition[], event: TelemetryEvent) {
    for (const t of transitions) {
      const rules = await db.execute<RuleRow>(sql`
        SELECT id, geofence_id, action, command_type, params
        FROM geofence_rules
        WHERE geofence_id = ${t.geofenceId} AND enabled
          AND trigger IN (${t.type}, 'both')
          AND (device_id IS NULL OR device_id = ${device.id})
      `);
      for (const rule of rules) {
        try {
          if (rule.action === "notify") {
            const verb = t.type === "enter" ? "entró en" : "salió de";
            await notifier.notifyDevice(device.tenantId, device.id, {
              title: `${device.name} ${verb} ${t.geofenceName}`,
              body: `${event.timestamp.toLocaleString("es", { timeZone: "UTC" })} UTC · ${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}`,
              url: `/dashboard?device=${device.id}`,
              tag: `gf-${device.id}-${t.geofenceId}`,
            });
          } else if (rule.command_type) {
            const type = rule.command_type;
            const supported = commandsFor(device.kind === "phone" ? "phone" : device.protocol).some((c) => c.type === type);
            const id = await commands.enqueue({
              tenantId: device.tenantId,
              deviceId: device.id,
              createdBy: null,
              type,
              params: rule.params ?? {},
            });
            if (BLOCKED_AUTOMATIC.has(type)) {
              await commands.mark(id, "failed", "El bloqueo de motor no se ejecuta automáticamente por seguridad");
            } else if (!supported || !getCommand(type)) {
              await commands.mark(id, "failed", `El protocolo ${device.protocol} no admite este comando`);
            } else {
              await commands.dispatch(id, device, type, rule.params ?? {});
            }
          }
          await db.execute(sql`UPDATE geofence_rules SET last_fired_at = now() WHERE id = ${rule.id}`);
        } catch (err) {
          console.error(`[automation] regla ${rule.id}:`, err);
        }
      }
    }
  };
}
