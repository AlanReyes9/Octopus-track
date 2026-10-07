import { getDb } from "@octopus/db";
import { detectionByImei } from "@octopus/ingest-core";
import { json, withAuth } from "@/lib/api";

/**
 * ¿Se ha conectado ya un equipo con este IMEI? Devuelve el protocolo
 * detectado. Solo búsqueda exacta (no se pueden listar IMEIs ajenos).
 */
export const GET = withAuth(
  async (req) => {
    const imei = new URL(req.url).searchParams.get("imei")?.trim() ?? "";
    if (!/^[A-Za-z0-9_-]{6,32}$/.test(imei)) return json({ detected: null });
    return json({ detected: await detectionByImei(getDb(), imei) });
  },
  { manage: true },
);
