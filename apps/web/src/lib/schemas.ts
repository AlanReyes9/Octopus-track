import { z } from "zod";

export const vehicleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  plate: z.string().trim().max(20).nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  deviceId: z.uuid().nullish(),
});

export const deviceSchema = z.object({
  imei: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,32}$/, "IMEI / identificador inválido"),
  name: z.string().trim().min(1).max(100),
  protocol: z.enum(["traccar", "osmand", "tcp-text"]).default("traccar"),
  phone: z.string().trim().max(30).nullish(),
});
