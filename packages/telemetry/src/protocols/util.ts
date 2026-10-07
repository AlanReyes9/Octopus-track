/** Utilidades compartidas por los decodificadores de protocolos GPS. */

/** CRC-16/X-25 (CRC-ITU), usado por GT06/Concox. */
export function crc16X25(buf: Buffer, start = 0, end = buf.length): number {
  let crc = 0xffff;
  for (let i = start; i < end; i++) {
    crc ^= buf[i]!;
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
  }
  return ~crc & 0xffff;
}

/** CRC-16/ARC (IBM), usado por Teltonika. */
export function crc16Ibm(buf: Buffer, start = 0, end = buf.length): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    crc ^= buf[i]!;
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc & 0xffff;
}

/** Coordenada NMEA "ddmm.mmmm" / "dddmm.mmmm" + hemisferio → grados decimales. */
export function nmeaToDegrees(value: string, hemisphere: string): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;
  const deg = Math.floor(v / 100);
  const dec = deg + (v - deg * 100) / 60;
  return hemisphere === "S" || hemisphere === "W" ? -dec : dec;
}

/** Fecha/hora UTC desde componentes con año de dos dígitos. */
export function utcDate(yy: number, mo: number, dd: number, hh: number, mi: number, ss: number, ms = 0): Date {
  return new Date(Date.UTC(2000 + yy, mo - 1, dd, hh, mi, ss, ms));
}

/** BCD empaquetado → dígitos (p. ej. IMEI de 8 bytes en GT06). */
export function bcdToString(buf: Buffer): string {
  let s = "";
  for (const byte of buf) s += (byte >> 4).toString(16) + (byte & 0x0f).toString(16);
  return s;
}

/** Divide un flujo de texto por un delimitador final (incluido en la trama). */
export function splitByDelimiter(buffer: Buffer, delimiter: string, maxFrame = 4096) {
  const frames: Buffer[] = [];
  let start = 0;
  let idx = buffer.indexOf(delimiter, start, "latin1");
  while (idx !== -1) {
    const frame = buffer.subarray(start, idx + delimiter.length);
    if (frame.toString("latin1").trim()) frames.push(frame);
    start = idx + delimiter.length;
    idx = buffer.indexOf(delimiter, start, "latin1");
  }
  let rest = buffer.subarray(start);
  if (rest.length > maxFrame) rest = Buffer.alloc(0); // basura: descartar
  return { frames, rest };
}

export const KNOTS = 1.852;
