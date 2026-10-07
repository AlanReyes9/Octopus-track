import formbody from "@fastify/formbody";
import Fastify from "fastify";
import { notePendingDevice, type Pipeline, type ProcessResult } from "@octopus/ingest-core";
import type { Database } from "@octopus/db";
import { decodeJsonGateway, decodeOsmAnd, TelemetryParseError, type TelemetryEvent } from "@octopus/telemetry";
import { timingSafeEqual } from "node:crypto";

function tokenMatches(expected: string | undefined, provided: unknown): boolean {
  if (!expected) return true; // sin token configurado (solo desarrollo)
  if (typeof provided !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

function statusCode(r: ProcessResult): number {
  switch (r.status) {
    case "stored":
    case "duplicate":
      return 200;
    case "unknown_device":
      return 404;
    case "rejected":
      return 422;
  }
}

export function buildHttpServer(pipeline: Pipeline, db: Database, opts: { ingestToken?: string }) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, bodyLimit: 256 * 1024 });
  app.register(formbody);

  const handle = async (decode: () => TelemetryEvent, peer?: string) => {
    let event: TelemetryEvent;
    try {
      event = decode();
    } catch (err) {
      if (err instanceof TelemetryParseError) return { code: 400, body: { error: err.message } };
      throw err;
    }
    const result = await pipeline.process(event);
    if (result.status === "unknown_device") await notePendingDevice(db, event.imei, event.source, peer);
    return { code: statusCode(result), body: result };
  };

  app.get("/health", async () => ({ ok: true }));

  /** Gateway HTTP JSON (servidores de protocolos GPS que reenvían posiciones). */
  app.post("/gateway", async (req, reply) => {
    const token = req.headers["x-ingest-token"] ?? (req.query as Record<string, string>).token;
    if (!tokenMatches(opts.ingestToken, token)) return reply.code(401).send({ error: "token inválido" });
    const r = await handle(() => decodeJsonGateway(req.body), req.ip);
    return reply.code(r.code).send(r.body);
  });

  /**
   * Protocolo HTTP OsmAnd (apps móviles de rastreo). El token va en la query
   * (?token=...) porque esas apps no permiten cabeceras personalizadas.
   */
  app.all("/osmand", async (req, reply) => {
    const params = { ...(req.query as Record<string, string>), ...((req.body as Record<string, string>) ?? {}) };
    if (!tokenMatches(opts.ingestToken, params.token)) return reply.code(401).send({ error: "token inválido" });
    delete params.token;
    const r = await handle(() => decodeOsmAnd(params), req.ip);
    return reply.code(r.code).send(r.body);
  });

  return app;
}
