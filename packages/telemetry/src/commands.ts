import { getProtocol } from "./protocols/catalog";

/**
 * Catálogo de comandos remotos. Contrato compartido entre la web (que los
 * encola) y los transportes que los entregan (TCP, gateway HTTP, teléfono).
 */
export type CommandType =
  | "requestPosition"
  | "setInterval"
  | "engineStop"
  | "engineResume"
  | "reboot"
  | "message"
  | "custom";

/** Id de protocolo del dispositivo (ver protocols/catalog.ts). */
export type DeviceTransport = string;

export interface CommandDefinition {
  type: CommandType;
  label: string;
  description: string;
  /** Requiere confirmación reforzada en la UI. */
  dangerous?: boolean;
  params?: { key: string; label: string; kind: "number" | "text"; min?: number; max?: number; maxLength?: number }[];
}

export const COMMANDS: CommandDefinition[] = [
  {
    type: "requestPosition",
    label: "Solicitar posición",
    description: "Pide al equipo que reporte su ubicación inmediatamente.",
  },
  {
    type: "setInterval",
    label: "Cambiar intervalo de reporte",
    description: "Frecuencia de envío de posiciones, en segundos.",
    params: [{ key: "seconds", label: "Segundos", kind: "number", min: 5, max: 86400 }],
  },
  {
    type: "engineStop",
    label: "Bloquear motor",
    description:
      "Corta la alimentación de combustible/encendido. Por seguridad solo se permite con el vehículo detenido.",
    dangerous: true,
  },
  {
    type: "engineResume",
    label: "Desbloquear motor",
    description: "Restablece el encendido tras un bloqueo.",
  },
  {
    type: "reboot",
    label: "Reiniciar equipo",
    description: "Reinicia el rastreador GPS.",
  },
  {
    type: "message",
    label: "Enviar mensaje",
    description: "Muestra un mensaje en el teléfono o en la pantalla del equipo.",
    params: [{ key: "text", label: "Mensaje", kind: "text", maxLength: 160 }],
  },
  {
    type: "custom",
    label: "Comando personalizado",
    description: "Texto libre que se envía tal cual al equipo (sintaxis del fabricante).",
    params: [{ key: "data", label: "Comando", kind: "text", maxLength: 200 }],
  },
];

/** Comandos que admite un protocolo según el catálogo. */
export function commandsFor(protocol: DeviceTransport): CommandDefinition[] {
  const supported = getProtocol(protocol)?.commands ?? [];
  return COMMANDS.filter((c) => supported.includes(c.type));
}

export function getCommand(type: string): CommandDefinition | undefined {
  return COMMANDS.find((c) => c.type === type);
}

/** Velocidad máxima (km/h) a la que se permite bloquear el motor. */
export const ENGINE_STOP_MAX_SPEED_KMH = 5;

// ---------------------------------------------------------------- protocolo TCP
// Servidor → equipo:  $CMD,<id>,<tipo>,<k=v;k=v>*
// Equipo → servidor:  $CMDACK,<id>,OK|ERR[,<mensaje>]*

const clean = (v: string) => v.replace(/[,;*=\r\n$]/g, " ").trim();

export function encodeTcpCommand(id: string, type: string, params: Record<string, unknown>): string {
  const p = Object.entries(params)
    .map(([k, v]) => `${clean(k)}=${clean(String(v))}`)
    .join(";");
  return `$CMD,${id},${type},${p}*`;
}

export function parseTcpCommandAck(line: string): { id: string; ok: boolean; message: string | null } | null {
  const m = /^\$CMDACK,([0-9a-fA-F-]{36}),(OK|ERR)(?:,(.*?))?\*?$/.exec(line.trim());
  if (!m) return null;
  return { id: m[1]!, ok: m[2] === "OK", message: m[3]?.trim() || null };
}
