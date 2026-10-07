import type { DecodeResult, ProtocolHandler } from "./types";
import { nmeaToDegrees, splitByDelimiter, utcDate } from "./util";

/**
 * TK103 clásico (Xexun / Coban / Tkstar y clones):
 *   (IIIIIIIIIIIICCCC[IMEI15]YYMMDDAddmm.mmmmNdddmm.mmmmEsss.sHHMMSSccc.cc...)
 * El identificador del equipo es el número de 12 dígitos tras "(".
 */
const POSITION =
  /^(\d{2})(\d{2})(\d{2})([AV])(\d{4}\.\d+)([NS])(\d{5}\.\d+)([EW])(\d{3}\.\d)(\d{2})(\d{2})(\d{2})(\d{3}\.\d{2})?/;

export const tk103: ProtocolHandler = {
  id: "tk103",
  detect: (b) => b[0] === 0x28 && /^\(\d{12}[A-Z]{2}\d{2}/.test(b.toString("latin1", 0, 20)),
  frame: (buffer) => splitByDelimiter(buffer, ")"),

  decode(frame): DecodeResult {
    const s = frame.toString("latin1").trim();
    const m = /^\((\d{12})([A-Z]{2}\d{2})(.*)\)$/.exec(s);
    if (!m) return { positions: [] };
    const [, id, cmd, rest] = m as unknown as [string, string, string, string];
    const result: DecodeResult = { identify: id, positions: [] };

    if (cmd === "BP00") {
      // Saludo / latido
      result.reply = Buffer.from(`(${id}AP01HSO)`);
      return result;
    }
    let payload = rest;
    if (cmd === "BP05") {
      payload = rest.slice(15); // IMEI de 15 dígitos antes de la posición
      result.reply = Buffer.from(`(${id}AP05)`);
    }
    if (["BR00", "BR01", "BP04", "BP05", "BO01", "BR02"].includes(cmd)) {
      if (cmd === "BO01") payload = payload.slice(1); // código de alarma
      const p = POSITION.exec(payload);
      if (p) {
        result.positions.push({
          timestamp: utcDate(+p[1]!, +p[2]!, +p[3]!, +p[10]!, +p[11]!, +p[12]!),
          valid: p[4] === "A",
          latitude: nmeaToDegrees(p[5]!, p[6]!),
          longitude: nmeaToDegrees(p[7]!, p[8]!),
          speedKmh: Number(p[9]),
          course: p[13] ? Number(p[13]) : null,
          attributes: { command: cmd },
        });
      }
    }
    return result;
  },
  /** Solo comando personalizado: el texto se envía tal cual (sintaxis del fabricante). */
  encodeCommand(type, params) {
    return type === "custom" && params.data ? Buffer.from(String(params.data), "latin1") : null;
  },
};
