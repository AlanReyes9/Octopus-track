import { KNOTS_TO_KMH } from "../geo";
import { normalize, TelemetryParseError } from "../normalize";
import type { TelemetryEvent } from "../types";

/**
 * Decodifica el JSON que envía el forwarder de Traccar:
 *  - Posiciones (`forward.url` + `forward.json=true`): { position, device }
 *  - Eventos (`event.forward.url`): { event, position, device }
 * Traccar reporta la velocidad en nudos.
 */
export function decodeTraccar(body: unknown): TelemetryEvent {
  if (!body || typeof body !== "object") throw new TelemetryParseError("payload vacío");
  const b = body as Record<string, any>;
  const position = b.position ?? b;
  const device = b.device ?? {};
  if (!position || typeof position !== "object") throw new TelemetryParseError("sin posición");

  const attributes: Record<string, unknown> = { ...(position.attributes ?? {}) };
  if (b.event?.type) attributes.traccarEvent = b.event.type;
  if (position.deviceId !== undefined) attributes.traccarDeviceId = position.deviceId;

  const speedKnots = position.speed;
  return normalize(
    {
      imei: device.uniqueId ?? position.uniqueId,
      timestamp: position.fixTime ?? position.deviceTime ?? position.serverTime,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      speedKmh:
        speedKnots === undefined || speedKnots === null ? null : Number(speedKnots) * KNOTS_TO_KMH,
      course: position.course,
      satellites: attributes.sat,
      ignition: attributes.ignition,
      valid: position.valid,
      attributes,
    },
    "traccar",
  );
}
