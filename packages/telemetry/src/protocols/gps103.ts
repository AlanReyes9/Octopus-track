import type { DecodeResult, ProtocolHandler } from "./types";
import { KNOTS, nmeaToDegrees, splitByDelimiter, utcDate } from "./util";

/**
 * GPS103 (Coban TK103A/B, TK102B, TK104, GPS303 y clones):
 *   ##,imei:359586015829802,A;            → login, respuesta "LOAD"
 *   359586015829802;                      → latido, respuesta "ON"
 *   imei:IMEI,tracker,YYMMDDhhmm,,F,hhmmss.sss,A,ddmm.mmmm,N,dddmm.mmmm,E,nudos,rumbo,...;
 */
export const gps103: ProtocolHandler = {
  id: "gps103",
  detect: (b) => {
    const s = b.toString("latin1", 0, 24);
    return s.startsWith("##,imei:") || s.startsWith("imei:") || /^\d{15};/.test(s);
  },
  frame: (buffer) => splitByDelimiter(buffer, ";"),

  decode(frame): DecodeResult {
    const s = frame.toString("latin1").trim().replace(/;$/, "");
    const login = /^##,imei:(\d+),A$/.exec(s);
    if (login) return { identify: login[1], positions: [], reply: Buffer.from("LOAD") };
    const heartbeat = /^(\d{15})$/.exec(s);
    if (heartbeat) return { identify: heartbeat[1], positions: [], reply: Buffer.from("ON") };

    const f = s.split(",");
    const imei = /^imei:(\d+)$/.exec(f[0] ?? "")?.[1];
    if (!imei) return { positions: [] };
    const result: DecodeResult = { identify: imei, positions: [] };
    const [, alarm, local, , fix, utc, validity, lat, ns, lon, ew, speed, course, altitude, acc] = f;
    if (fix !== "F" || !local || !utc || !lat || !lon) return result; // "L" = solo celda GSM
    const t = /^(\d{2})(\d{2})(\d{2})(\.\d+)?$/.exec(utc);
    if (!t) return result;
    result.positions.push({
      // Fecha de la hora local del equipo + hora UTC del GPS.
      timestamp: utcDate(+local.slice(0, 2), +local.slice(2, 4), +local.slice(4, 6), +t[1]!, +t[2]!, +t[3]!),
      valid: validity === "A",
      latitude: nmeaToDegrees(lat, ns ?? "N"),
      longitude: nmeaToDegrees(lon, ew ?? "E"),
      speedKmh: speed ? Number(speed) * KNOTS : null,
      course: course || null,
      altitude: altitude || null,
      ignition: acc === "1" ? true : acc === "0" ? false : alarm === "acc on" ? true : alarm === "acc off" ? false : null,
      attributes: alarm && alarm !== "tracker" ? { alarm } : {},
    });
    return result;
  },

  encodeCommand(type, params, ctx) {
    const base = `**,imei:${ctx.imei},`;
    switch (type) {
      case "requestPosition":
        return Buffer.from(`${base}B;`);
      case "engineStop":
        return Buffer.from(`${base}J;`);
      case "engineResume":
        return Buffer.from(`${base}K;`);
      case "setInterval":
        return Buffer.from(`${base}C,${Math.max(10, Number(params.seconds))}s;`);
      case "custom":
        return Buffer.from(String(params.data ?? ""));
      default:
        return null;
    }
  },
};
