import { KNOTS_TO_KMH } from "../geo";
import { normalize, TelemetryParseError } from "../normalize";
import type { TelemetryEvent } from "../types";

/**
 * Protocolo OsmAnd (el que usan Traccar Client y muchas apps móviles):
 * `?id=IMEI&lat=..&lon=..&timestamp=..&speed=..&bearing=..&altitude=..`
 * La velocidad viene en nudos.
 */
export function decodeOsmAnd(params: URLSearchParams | Record<string, string>): TelemetryEvent {
  const p = params instanceof URLSearchParams ? Object.fromEntries(params) : params;
  const id = p.id ?? p.deviceid;
  if (!id) throw new TelemetryParseError("falta id");

  const known = new Set(["id", "deviceid", "lat", "lon", "timestamp", "speed", "bearing", "heading", "altitude", "valid"]);
  const attributes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!known.has(k)) attributes[k] = v;

  return normalize(
    {
      imei: id,
      timestamp: p.timestamp ?? Date.now(),
      latitude: p.lat,
      longitude: p.lon,
      altitude: p.altitude,
      speedKmh: p.speed ? Number(p.speed) * KNOTS_TO_KMH : null,
      course: p.bearing ?? p.heading,
      satellites: p.sat,
      ignition: p.ignition,
      valid: p.valid,
      attributes,
    },
    "osmand",
  );
}
