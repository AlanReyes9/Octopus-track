import type { DecodeResult, ProtocolHandler } from "./types";
import { KNOTS, nmeaToDegrees, splitByDelimiter, utcDate } from "./util";

/**
 * H02 en modo texto (Sinotrack ST-901/ST-906, Huabao y clones):
 *   *HQ,ID,V1,hhmmss,A,ddmm.mmmm,N,dddmm.mmmm,E,nudos,rumbo,DDMMYY,estado,...#
 */
export const h02: ProtocolHandler = {
  id: "h02",
  detect: (b) => b.toString("latin1", 0, 4) === "*HQ,",
  frame: (buffer) => splitByDelimiter(buffer, "#"),

  decode(frame): DecodeResult {
    const s = frame.toString("latin1").trim().replace(/#$/, "");
    const f = s.split(",");
    if (f[0] !== "*HQ" || !f[1]) return { positions: [] };
    const result: DecodeResult = { identify: f[1], positions: [] };
    const [, , cmd, time, validity, lat, ns, lon, ew, speed, course, date, status] = f;
    if (!["V1", "V4", "V19", "NBR"].includes(cmd ?? "") || !time || !date || !lat || !lon) return result;
    if (cmd === "NBR") return result; // solo celdas GSM
    result.positions.push({
      timestamp: utcDate(+date.slice(4, 6), +date.slice(2, 4), +date.slice(0, 2), +time.slice(0, 2), +time.slice(2, 4), +time.slice(4, 6)),
      valid: validity === "A",
      latitude: nmeaToDegrees(lat, ns ?? "N"),
      longitude: nmeaToDegrees(lon, ew ?? "E"),
      speedKmh: speed ? Number(speed) * KNOTS : null,
      course: course || null,
      attributes: { status },
    });
    return result;
  },
  /** Solo comando personalizado: el texto se envía tal cual (sintaxis del fabricante). */
  encodeCommand(type, params) {
    return type === "custom" && params.data ? Buffer.from(String(params.data), "latin1") : null;
  },
};
