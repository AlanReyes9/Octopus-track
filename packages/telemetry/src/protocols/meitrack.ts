import type { DecodeResult, ProtocolHandler } from "./types";
import { splitByDelimiter, utcDate } from "./util";

/**
 * Meitrack (MVT, T1, T3xx...), mensajes AAA:
 *   $$<flag><len>,<imei>,AAA,<evento>,<lat>,<lon>,YYMMDDhhmmss,<A|V>,<sats>,<gsm>,<km/h>,<rumbo>,<hdop>,<alt>,...*CS\r\n
 */
export const meitrack: ProtocolHandler = {
  id: "meitrack",
  detect: (b) => b.toString("latin1", 0, 2) === "$$",
  frame: (buffer) => splitByDelimiter(buffer, "\r\n"),

  decode(frame): DecodeResult {
    const s = frame.toString("latin1").trim();
    const f = s.split(",");
    const imei = f[1];
    if (!s.startsWith("$$") || !imei) return { positions: [] };
    const result: DecodeResult = { identify: imei, positions: [] };
    if (f[2] !== "AAA") return result;
    const [, , , event, lat, lon, dt, validity, sats, , speed, course, , altitude] = f;
    if (!dt || dt.length !== 12) return result;
    result.positions.push({
      timestamp: utcDate(+dt.slice(0, 2), +dt.slice(2, 4), +dt.slice(4, 6), +dt.slice(6, 8), +dt.slice(8, 10), +dt.slice(10, 12)),
      valid: validity === "A",
      latitude: lat,
      longitude: lon,
      satellites: sats,
      speedKmh: speed,
      course,
      altitude,
      attributes: { event: Number(event) },
    });
    return result;
  },
  /** Solo comando personalizado: el texto se envía tal cual (sintaxis del fabricante). */
  encodeCommand(type, params) {
    return type === "custom" && params.data ? Buffer.from(String(params.data), "latin1") : null;
  },
};
