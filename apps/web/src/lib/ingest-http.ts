import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "@octopus/db";
import { notePendingDevice, type ProcessResult } from "@octopus/ingest-core";
import { TelemetryParseError, type TelemetryEvent } from "@octopus/telemetry";
import { json } from "@/lib/api";
import { getPipeline } from "@/lib/ingest";

export function checkIngestToken(provided: string | null): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return false; // en Vercel la ingesta exige token siempre
  if (!provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STATUS: Record<ProcessResult["status"], number> = {
  stored: 200,
  duplicate: 200,
  unknown_device: 404,
  rejected: 422,
};

export async function ingest(decode: () => TelemetryEvent): Promise<Response> {
  let event: TelemetryEvent;
  try {
    event = decode();
  } catch (err) {
    if (err instanceof TelemetryParseError) return json({ error: err.message }, 400);
    throw err;
  }
  const result = await getPipeline().process(event);
  if (result.status === "unknown_device") {
    await notePendingDevice(getDb(), event.imei, event.source, null).catch(() => {});
  }
  return json(result, STATUS[result.status]);
}
