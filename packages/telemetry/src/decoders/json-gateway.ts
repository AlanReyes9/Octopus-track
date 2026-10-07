import { KNOTS_TO_KMH } from "../geo";
import { normalize, TelemetryParseError } from "../normalize";
import type { TelemetryEvent } from "../types";

/**
 * Gateway HTTP JSON: formato `{ position, device, event? }` que emiten los
 * servidores de protocolos GPS de terceros al reenviar posiciones (p. ej.
 * servidores de código abierto que traducen cientos de protocolos de
 * hardware). Solo se interpreta el formato de datos; no se incluye código
 * de terceros. La velocidad llega en nudos.
 */
export function decodeJsonGateway(body: unknown): TelemetryEvent {
  if (!body || typeof body !== "object") throw new TelemetryParseError("payload vacío");
  const b = body as Record<string, any>;
  const position = b.position ?? b;
  const device = b.device ?? {};
  if (!position || typeof position !== "object") throw new TelemetryParseError("sin posición");

  const attributes: Record<string, unknown> = { ...(position.attributes ?? {}) };
  if (b.event?.type) attributes.event = b.event.type;
  if (position.deviceId !== undefined) attributes.gatewayDeviceId = position.deviceId;

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
    "gateway",
  );
}
