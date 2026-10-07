/**
 * Evento de telemetría normalizado. Es el contrato único entre los
 * decodificadores de protocolo (Traccar, OsmAnd, TCP propio...) y el
 * pipeline de procesamiento. No contiene nada específico de BD ni de UI.
 */
export interface TelemetryEvent {
  /** Identificador del equipo (IMEI o uniqueId de Traccar). */
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

export type TelemetrySource = "traccar" | "osmand" | "tcp-text" | "simulator";

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
    };

/** Canal de Redis por inquilino. */
export const tenantChannel = (tenantId: string) => `tenant:${tenantId}:live`;
export const TENANT_CHANNEL_PATTERN = "tenant:*:live";
