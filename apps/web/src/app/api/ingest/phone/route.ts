import { z } from "zod";
import { normalize } from "@octopus/telemetry";
import { errorResponse, json, parseBody } from "@/lib/api";
import { getPipeline } from "@/lib/ingest";
import { phoneFromRequest } from "@/lib/phone-auth";
import { takePhoneCommands } from "@/server/commands";

/** Datos de la Geolocation API del navegador (W3C). */
const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().max(100_000),
  altitude: z.number().nullish(),
  /** metros por segundo */
  speed: z.number().nonnegative().max(150).nullish(),
  heading: z.number().nullish(),
  timestamp: z.number(),
  battery: z.number().min(0).max(1).nullish(),
});

/** Precisión máxima (m) para usar el punto en geocercas. */
const MAX_ACCURACY_M = 150;

export async function POST(req: Request) {
  try {
    const device = await phoneFromRequest(req, { requireConsent: true });
    const p = await parseBody(req, schema);
    const event = normalize(
      {
        imei: device.imei,
        timestamp: p.timestamp,
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        speedKmh: p.speed == null ? null : p.speed * 3.6,
        course: p.heading,
        valid: p.accuracy <= MAX_ACCURACY_M,
        attributes: {
          accuracy: Math.round(p.accuracy),
          ...(p.battery != null ? { battery: Math.round(p.battery * 100) } : {}),
        },
      },
      "phone",
    );
    const result = await getPipeline().process(event);
    const commands = await takePhoneCommands(device.id);
    return json({ status: result.status, commands });
  } catch (err) {
    return errorResponse(err);
  }
}
