import { normalize, TelemetryParseError } from "../normalize";
import type { TelemetryEvent } from "../types";

/**
 * Protocolo de texto propio para el socket TCP (una trama por línea):
 *
 *   $POS,<imei>,<timestamp>,<lat>,<lon>,<speed_kmh>,<course>,<alt>,<sats>,<ignition>*
 *
 * - timestamp: ISO-8601 o epoch (segundos/milisegundos)
 * - Los campos desde speed_kmh son opcionales (pueden ir vacíos).
 * - Respuesta del servidor: `$ACK,<imei>\r\n` o `$NAK,<motivo>\r\n`.
 */
export function decodeTcpTextLine(line: string): TelemetryEvent {
  const trimmed = line.trim();
  const m = /^\$POS,(.*?)\*?$/.exec(trimmed);
  if (!m) throw new TelemetryParseError("trama desconocida");
  const f = m[1]!.split(",");
  if (f.length < 4) throw new TelemetryParseError("trama incompleta");
  const [imei, timestamp, lat, lon, speed, course, alt, sats, ignition] = f;
  return normalize(
    {
      imei,
      timestamp,
      latitude: lat,
      longitude: lon,
      speedKmh: speed,
      course,
      altitude: alt,
      satellites: sats,
      ignition,
    },
    "tcp-text",
  );
}

export function encodeTcpTextLine(e: {
  imei: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  course?: number | null;
  altitude?: number | null;
  satellites?: number | null;
  ignition?: boolean | null;
}): string {
  const opt = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "" : v.toFixed(d));
  return [
    "$POS",
    e.imei,
    e.timestamp.toISOString(),
    e.latitude.toFixed(7),
    e.longitude.toFixed(7),
    opt(e.speedKmh),
    opt(e.course),
    opt(e.altitude),
    e.satellites ?? "",
    e.ignition === null || e.ignition === undefined ? "" : e.ignition ? "1" : "0",
  ].join(",") + "*";
}

/**
 * Separa un flujo TCP en líneas completas. Mantiene el resto parcial entre
 * paquetes y descarta buffers anómalos para evitar crecimiento sin límite.
 */
export class LineFramer {
  private buffer = "";
  constructor(private readonly maxBuffer = 8192) {}

  push(chunk: string): string[] {
    this.buffer += chunk;
    const parts = this.buffer.split(/\r?\n/);
    this.buffer = parts.pop() ?? "";
    if (this.buffer.length > this.maxBuffer) this.buffer = "";
    return parts.filter((p) => p.trim().length > 0);
  }
}
