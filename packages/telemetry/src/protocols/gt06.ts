import type { DecodeResult, ProtocolHandler } from "./types";
import { bcdToString, crc16X25, utcDate } from "./util";

/**
 * GT06 (Concox / Jimi IoT y compatibles: GT06N, TK100, JM01, WeTrack...).
 * Paquete corto: 78 78 | len(1) | protocolo(1) | datos | serie(2) | CRC(2) | 0D 0A
 * Paquete largo: 79 79 | len(2) | ...
 * Implementado a partir de la especificación pública del fabricante.
 */

const LOGIN = 0x01;
const GPS = 0x10;
const LBS = 0x11;
const GPS_LBS = 0x12;
const STATUS = 0x13;
const STRING_INFO = 0x15;
const GPS_LBS_STATUS = 0x16;
const GPS_LBS_2 = 0x22;
const COMMAND = 0x80;

function packet(protocol: number, serial: number, content: Buffer = Buffer.alloc(0)): Buffer {
  const len = 1 + content.length + 2 + 2; // protocolo + datos + serie + crc
  const body = Buffer.concat([Buffer.from([len, protocol]), content, Buffer.from([serial >> 8, serial & 0xff])]);
  const crc = crc16X25(body);
  return Buffer.concat([Buffer.from([0x78, 0x78]), body, Buffer.from([crc >> 8, crc & 0xff, 0x0d, 0x0a])]);
}

/** Bloque GPS común: fecha(6) info(1) lat(4) lon(4) velocidad(1) rumbo/estado(2) = 18 bytes. */
function decodeGps(d: Buffer, o: number) {
  const time = utcDate(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!);
  const satellites = d[o + 6]! & 0x0f;
  let lat = d.readUInt32BE(o + 7) / 1_800_000;
  let lon = d.readUInt32BE(o + 11) / 1_800_000;
  const speed = d[o + 15]!;
  const flags = d.readUInt16BE(o + 16);
  const course = flags & 0x03ff;
  const valid = (flags & 0x1000) !== 0;
  if (!(flags & 0x0400)) lat = -lat; // bit 10: 1 = norte
  if (flags & 0x0800) lon = -lon; // bit 11: 1 = oeste
  return { timestamp: time, latitude: lat, longitude: lon, speedKmh: speed, course, satellites, valid };
}

export const gt06: ProtocolHandler = {
  id: "gt06",

  detect: (b) => b.length >= 2 && ((b[0] === 0x78 && b[1] === 0x78) || (b[0] === 0x79 && b[1] === 0x79)),

  frame(buffer) {
    const frames: Buffer[] = [];
    let i = 0;
    while (i + 5 <= buffer.length) {
      const short = buffer[i] === 0x78 && buffer[i + 1] === 0x78;
      const long = buffer[i] === 0x79 && buffer[i + 1] === 0x79;
      if (!short && !long) {
        i++; // resincroniza
        continue;
      }
      const len = short ? buffer[i + 2]! : buffer.readUInt16BE(i + 2);
      const total = (short ? 3 : 4) + len + 2;
      if (i + total > buffer.length) break;
      frames.push(buffer.subarray(i, i + total));
      i += total;
    }
    return { frames, rest: buffer.subarray(i) };
  },

  decode(frame, session): DecodeResult {
    const short = frame[0] === 0x78;
    const head = short ? 3 : 4;
    const protocol = frame[head]!;
    const data = frame.subarray(head + 1, frame.length - 6); // sin serie, CRC ni 0D0A
    const serial = frame.readUInt16BE(frame.length - 6);
    const result: DecodeResult = { positions: [] };

    switch (protocol) {
      case LOGIN: {
        // IMEI en BCD de 8 bytes (16 dígitos con un 0 inicial).
        result.identify = bcdToString(data.subarray(0, 8)).replace(/^0/, "");
        result.reply = packet(LOGIN, serial);
        break;
      }
      case GPS:
      case GPS_LBS:
      case GPS_LBS_2:
      case GPS_LBS_STATUS: {
        if (data.length < 18) break;
        const gps = decodeGps(data, 0);
        let ignition: boolean | null = null;
        const attributes: Record<string, unknown> = { protocol: `0x${protocol.toString(16)}` };
        if (protocol === GPS_LBS_2 && data.length >= 18 + 8 + 1) {
          ignition = data[18 + 8] === 1; // tras MCC(2) MNC(1) LAC(2) CellID(3)
        }
        if (protocol === GPS_LBS_STATUS && data.length >= 18 + 9 + 1) {
          const info = data[18 + 9]!; // tras LBS (len + MCC + MNC + LAC + CellID)
          ignition = (info & 0x02) !== 0;
          attributes.alarm = (info >> 3) & 0x07;
        }
        result.positions.push({ ...gps, ignition, attributes });
        if (protocol === GPS_LBS_STATUS) result.reply = packet(GPS_LBS_STATUS, serial);
        break;
      }
      case STATUS: {
        // Latido: info del terminal. No trae posición; se confirma.
        result.reply = packet(STATUS, serial);
        break;
      }
      case LBS:
        break;
      case STRING_INFO: {
        // Respuesta a comando: len(1) flag(4) texto [idioma(2)]
        const len = data[0]!;
        const ref = data.readUInt32BE(1);
        const text = data.subarray(5, 1 + len).toString("latin1").trim();
        result.commandResponse = { ok: true, text, ref };
        break;
      }
      default:
        // Otros paquetes (0x94 info, etc.): se ignoran sin cortar la conexión.
        break;
    }
    void session;
    return result;
  },

  encodeCommand(type, params, ctx) {
    const text =
      type === "requestPosition"
        ? "WHERE#"
        : type === "engineStop"
          ? "RELAY,1#"
          : type === "engineResume"
            ? "RELAY,0#"
            : type === "reboot"
              ? "RESET#"
              : type === "setInterval"
                ? `TIMER,${Number(params.seconds)}#`
                : type === "custom"
                  ? String(params.data ?? "")
                  : null;
    if (!text) return null;
    const cmd = Buffer.from(text, "latin1");
    const flag = Buffer.alloc(4);
    flag.writeUInt32BE(ctx.ref >>> 0);
    const content = Buffer.concat([Buffer.from([4 + cmd.length]), flag, cmd, Buffer.from([0x00, 0x02])]);
    return packet(COMMAND, ctx.ref & 0xffff, content);
  },
};

/** Utilidad para pruebas y simuladores: construye un paquete GT06 válido. */
export const buildGt06Packet = packet;
