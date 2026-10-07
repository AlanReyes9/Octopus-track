import type { DecodeResult, ProtocolHandler } from "./types";
import { crc16Ibm } from "./util";

/**
 * Teltonika (FMB/FMC/FMM...), TCP:
 *  1. Saludo: len(2) + IMEI ASCII  → el servidor responde 0x01.
 *  2. AVL: 00000000 | len(4) | codec(1) | n(1) | registros | n(1) | CRC-16/IBM(4)
 *     Codec 8 (0x08) y Codec 8 Extended (0x8E). Respuesta: n de registros (4 bytes).
 *  3. Comandos Codec 12 (0x0C): tipo 0x05 = comando, 0x06 = respuesta.
 * Implementado a partir de la documentación pública de Teltonika.
 */

const IO_IGNITION = 239;

function isImeiHello(b: Buffer) {
  if (b.length < 2) return false;
  const len = b.readUInt16BE(0);
  return len >= 15 && len <= 17;
}

function decodeAvl(frame: Buffer): DecodeResult {
  const codec = frame[8]!;
  const count = frame[9]!;
  const result: DecodeResult = { positions: [] };
  let o = 10;
  const ext = codec === 0x8e;
  const rd = (bytes: 1 | 2) => {
    const v = bytes === 1 ? frame[o]! : frame.readUInt16BE(o);
    o += bytes;
    return v;
  };

  for (let r = 0; r < count; r++) {
    const timestamp = new Date(Number(frame.readBigUInt64BE(o)));
    o += 8;
    o += 1; // prioridad
    const lon = frame.readInt32BE(o) / 1e7;
    const lat = frame.readInt32BE(o + 4) / 1e7;
    const altitude = frame.readInt16BE(o + 8);
    const course = frame.readUInt16BE(o + 10);
    const satellites = frame[o + 12]!;
    const speed = frame.readUInt16BE(o + 13);
    o += 15;

    const idSize = ext ? 2 : 1;
    const eventId = rd(idSize);
    rd(idSize); // total de elementos IO
    const io: Record<string, number | string> = {};
    for (const size of [1, 2, 4, 8] as const) {
      const n = rd(idSize);
      for (let i = 0; i < n; i++) {
        const id = rd(idSize);
        let value: number | string;
        if (size === 1) value = frame[o]!;
        else if (size === 2) value = frame.readUInt16BE(o);
        else if (size === 4) value = frame.readUInt32BE(o);
        else value = frame.readBigUInt64BE(o).toString();
        o += size;
        io[`io${id}`] = value;
      }
    }
    if (ext) {
      const nx = rd(2);
      for (let i = 0; i < nx; i++) {
        const id = rd(2);
        const len = rd(2);
        io[`io${id}`] = frame.subarray(o, o + len).toString("hex");
        o += len;
      }
    }
    const ign = io[`io${IO_IGNITION}`];
    result.positions.push({
      timestamp,
      latitude: lat,
      longitude: lon,
      altitude,
      course,
      satellites,
      speedKmh: speed,
      // Satélites = 0 indica posición no válida en Teltonika.
      valid: satellites > 0,
      ignition: ign === undefined ? null : ign === 1,
      attributes: { event: eventId, ...io },
    });
  }
  const ack = Buffer.alloc(4);
  ack.writeUInt32BE(count);
  result.reply = ack;
  return result;
}

export const teltonika: ProtocolHandler = {
  id: "teltonika",
  detect: (b) => {
    if (!isImeiHello(b)) return false;
    const len = b.readUInt16BE(0);
    return /^\d{15,17}$/.test(b.toString("latin1", 2, 2 + len));
  },

  frame(buffer) {
    const frames: Buffer[] = [];
    let i = 0;
    while (i < buffer.length) {
      if (buffer.length - i >= 2 && isImeiHello(buffer.subarray(i))) {
        const total = 2 + buffer.readUInt16BE(i);
        if (i + total > buffer.length) break;
        frames.push(buffer.subarray(i, i + total));
        i += total;
        continue;
      }
      if (buffer.length - i < 8) break;
      if (buffer.readUInt32BE(i) !== 0) {
        i++; // resincroniza hasta el preámbulo de ceros
        continue;
      }
      const total = 8 + buffer.readUInt32BE(i + 4) + 4;
      if (total > 64 * 1024) {
        i += 4;
        continue;
      }
      if (i + total > buffer.length) break;
      frames.push(buffer.subarray(i, i + total));
      i += total;
    }
    return { frames, rest: buffer.subarray(i) };
  },

  decode(frame): DecodeResult {
    if (frame.readUInt32BE(0) !== 0 && isImeiHello(frame)) {
      return { identify: frame.toString("latin1", 2), positions: [], reply: Buffer.from([0x01]) };
    }
    const dataLen = frame.readUInt32BE(4);
    const crc = frame.readUInt32BE(8 + dataLen);
    if (crc16Ibm(frame, 8, 8 + dataLen) !== crc) return { positions: [] }; // trama corrupta: sin ACK → reenvío
    const codec = frame[8]!;
    if (codec === 0x08 || codec === 0x8e) return decodeAvl(frame);
    if (codec === 0x0c && frame[10] === 0x06) {
      const len = frame.readUInt32BE(11);
      return { positions: [], commandResponse: { ok: true, text: frame.toString("latin1", 15, 15 + len).trim() } };
    }
    return { positions: [] };
  },

  encodeCommand(type, params) {
    const text =
      type === "requestPosition"
        ? "getgps"
        : type === "engineStop"
          ? "setdigout 1"
          : type === "engineResume"
            ? "setdigout 0"
            : type === "reboot"
              ? "cpureset"
              : type === "custom"
                ? String(params.data ?? "")
                : null;
    if (!text) return null;
    const cmd = Buffer.from(text, "latin1");
    const size = Buffer.alloc(4);
    size.writeUInt32BE(cmd.length);
    const data = Buffer.concat([Buffer.from([0x0c, 0x01, 0x05]), size, cmd, Buffer.from([0x01])]);
    const header = Buffer.alloc(8);
    header.writeUInt32BE(data.length, 4);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc16Ibm(data));
    return Buffer.concat([header, data, crc]);
  },
};
