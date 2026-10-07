import { ALL_PROTOCOLS } from "@octopus/telemetry";
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
  kind: z.enum(["gps", "phone"]).default("gps"),
  protocol: z
    .string()
    .refine((p) => ALL_PROTOCOLS.some((x) => x.id === p && x.id !== "phone"), "Protocolo no válido")
    .default("gt06"),
  phone: z.string().trim().max(30).nullish(),
});

export const phoneDeviceSchema = z.object({
  kind: z.literal("phone"),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).nullish(),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  role: z.enum(["viewer", "admin"]).default("viewer"),
  vehicleIds: z.array(z.uuid()).max(500).default([]),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(["viewer", "admin"]).optional(),
  vehicleIds: z.array(z.uuid()).max(500).optional(),
});

export const passwordSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(200)
  .regex(/[A-Za-z]/, "Debe incluir letras")
  .regex(/[0-9]/, "Debe incluir números");

export const commandSchema = z.object({
  type: z.string().min(1).max(40),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
