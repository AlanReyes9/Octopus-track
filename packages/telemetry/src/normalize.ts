import { z } from "zod";
import { isValidLatitude, isValidLongitude, roundCoord } from "./geo";
import type { TelemetryEvent, TelemetrySource } from "./types";

export class TelemetryParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelemetryParseError";
  }
}

/** Entrada intermedia que producen los decodificadores antes de validar. */
export interface RawTelemetry {
  imei: unknown;
  timestamp: unknown;
  latitude: unknown;
  longitude: unknown;
  altitude?: unknown;
  speedKmh?: unknown;
  course?: unknown;
  satellites?: unknown;
  ignition?: unknown;
  valid?: unknown;
  attributes?: Record<string, unknown>;
}

const num = z.coerce.number().refine(Number.isFinite);
const optionalNum = z
  .union([z.null(), z.undefined(), z.literal(""), num])
  .transform((v) => (v === "" || v === undefined ? null : v));

const boolish = z
  .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = v.toLowerCase();
    if (["1", "true", "on", "yes"].includes(s)) return true;
    if (["0", "false", "off", "no"].includes(s)) return false;
    return null;
  });

const imeiSchema = z.coerce
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "identificador de dispositivo inválido");

/** Acepta Date, ISO-8601, epoch en segundos o en milisegundos. */
export function parseTimestamp(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?$/.test(value))) {
    const n = Number(value);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  if (typeof value === "string") return new Date(value);
  return new Date(NaN);
}

export function normalize(raw: RawTelemetry, source: TelemetrySource): TelemetryEvent {
  const imei = imeiSchema.safeParse(raw.imei);
  if (!imei.success) throw new TelemetryParseError("imei ausente o inválido");

  const lat = num.safeParse(raw.latitude);
  const lon = num.safeParse(raw.longitude);
  if (!lat.success || !isValidLatitude(lat.data)) throw new TelemetryParseError("latitud inválida");
  if (!lon.success || !isValidLongitude(lon.data)) throw new TelemetryParseError("longitud inválida");

  const timestamp = parseTimestamp(raw.timestamp);
  if (Number.isNaN(timestamp.getTime())) throw new TelemetryParseError("timestamp inválido");

  const speed = optionalNum.parse(raw.speedKmh);
  const course = optionalNum.parse(raw.course);
  const sats = optionalNum.parse(raw.satellites);
  const valid = boolish.parse(raw.valid);

  return {
    imei: imei.data,
    timestamp,
    latitude: roundCoord(lat.data),
    longitude: roundCoord(lon.data),
    altitude: optionalNum.parse(raw.altitude),
    speedKmh: speed === null ? null : Math.max(0, speed),
    course: course === null ? null : ((course % 360) + 360) % 360,
    satellites: sats === null ? null : Math.round(sats),
    ignition: boolish.parse(raw.ignition),
    valid: valid ?? true,
    attributes: raw.attributes ?? {},
    source,
  };
}
