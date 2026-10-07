/**
 * Evento de telemetría normalizado. Es el contrato único entre los
 * decodificadores de protocolo (gateway JSON, OsmAnd, TCP propio, teléfono) y el
 * pipeline de procesamiento. No contiene nada específico de BD ni de UI.
 */
export interface TelemetryEvent {
  /** Identificador del equipo (IMEI o identificador único). */
  imei: string;
  /** Momento del fix GPS (UTC). */
  timestamp: Date;
  /** Grados decimales, redondeados a 7 decimales (DECIMAL(10,7)). */
  latitude: number;
  longitude: number;
  altitude: number | null;
  /** Velocidad en km/h. */
  speedKmh: number | null;
  /** Rumbo en grados [0, 360). */
  course: number | null;
  satellites: number | null;
  ignition: boolean | null;
  /** Si el equipo reporta un fix válido. */
  valid: boolean;
  /** Atributos adicionales del protocolo (batería, odómetro, etc.). */
  attributes: Record<string, unknown>;
  /** Origen del evento, para trazabilidad. */
  source: TelemetrySource;
}

/** Protocolo de origen (id del catálogo de protocolos). */
export type TelemetrySource = string;

/** Mensaje publicado en Redis y retransmitido a los navegadores. */
export type LiveMessage =
  | {
      type: "position";
      tenantId: string;
      deviceId: string;
      vehicleId: string | null;
      time: string;
      latitude: number;
      longitude: number;
      speedKmh: number | null;
      course: number | null;
      ignition: boolean | null;
    }
  | {
      type: "geofence";
      tenantId: string;
      deviceId: string;
      vehicleId: string | null;
      geofenceId: string;
      geofenceName: string;
      event: "enter" | "exit";
      time: string;
    }
  | {
      type: "command";
      tenantId: string;
      deviceId: string;
      commandId: string;
      status: "pending" | "sent" | "delivered" | "failed" | "cancelled";
      result: string | null;
    };

/** Canal de Redis por inquilino. */
export const tenantChannel = (tenantId: string) => `tenant:${tenantId}:live`;
export const TENANT_CHANNEL_PATTERN = "tenant:*:live";

/** Canal donde la web publica comandos nuevos para el servicio de ingesta. */
export const COMMANDS_CHANNEL = "octopus:commands";
