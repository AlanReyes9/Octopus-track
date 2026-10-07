import { Redis } from "ioredis";
import { createDb } from "@octopus/db";
import { createCommandStore, createPipeline, publisherFromEnv } from "@octopus/ingest-core";
import { COMMANDS_CHANNEL } from "@octopus/telemetry";
import { buildHttpServer } from "./http";
import { buildTcpServer } from "./tcp";

const httpPort = Number(process.env.INGEST_HTTP_PORT ?? process.env.PORT ?? 4000);
const tcpPort = Number(process.env.INGEST_TCP_PORT ?? 5023);

const { db, sql } = createDb({ max: Number(process.env.DB_POOL_MAX ?? 10) });
const publisher = publisherFromEnv();
const pipeline = createPipeline({ db, publisher });
const commands = createCommandStore(db, publisher);

const http = buildHttpServer(pipeline, { ingestToken: process.env.INGEST_TOKEN });
const tcp = buildTcpServer(pipeline, commands);

// Comandos encolados desde la web: entrega inmediata si el equipo está conectado.
let sub: Redis | null = null;
if (process.env.REDIS_URL) {
  sub = new Redis(process.env.REDIS_URL);
  sub.on("error", (err) => console.error("[redis]", err.message));
  await sub.subscribe(COMMANDS_CHANNEL);
  sub.on("message", (_channel, commandId) => {
    tcp.onCommandQueued(commandId).catch((err) => console.error("[commands]", err));
  });
}

await http.listen({ port: httpPort, host: "0.0.0.0" });
tcp.server.listen(tcpPort, "0.0.0.0", () => console.log(`[tcp] escuchando en :${tcpPort}`));

async function shutdown() {
  console.log("cerrando ingesta…");
  tcp.server.close();
  sub?.disconnect();
  await http.close();
  await publisher.close?.();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
