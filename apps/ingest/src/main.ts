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

const http = buildHttpServer(pipeline, db, { ingestToken: process.env.INGEST_TOKEN });
// Puerto principal con detección automática del protocolo + puertos dedicados
// opcionales: INGEST_PROTOCOL_PORTS="gt06:5023,teltonika:5027,gps103:5001"
const tcp = buildTcpServer(pipeline, commands, db);
const dedicated = (process.env.INGEST_PROTOCOL_PORTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [protocol, port] = entry.split(":");
    return { protocol: protocol!, port: Number(port), srv: buildTcpServer(pipeline, commands, db, { protocol }) };
  });

// Comandos encolados desde la web: entrega inmediata si el equipo está conectado.
let sub: Redis | null = null;
if (process.env.REDIS_URL) {
  sub = new Redis(process.env.REDIS_URL);
  sub.on("error", (err) => console.error("[redis]", err.message));
  await sub.subscribe(COMMANDS_CHANNEL);
  sub.on("message", (_channel, commandId) => {
    for (const t of [tcp, ...dedicated.map((d) => d.srv)]) {
      t.onCommandQueued(commandId).catch((err) => console.error("[commands]", err));
    }
  });
}

await http.listen({ port: httpPort, host: "0.0.0.0" });
tcp.server.listen(tcpPort, "0.0.0.0", () => console.log(`[tcp] autodetección de protocolo en :${tcpPort}`));
for (const d of dedicated) {
  d.srv.server.listen(d.port, "0.0.0.0", () => console.log(`[tcp] ${d.protocol} en :${d.port}`));
}

async function shutdown() {
  console.log("cerrando ingesta…");
  tcp.server.close();
  dedicated.forEach((d) => d.srv.server.close());
  sub?.disconnect();
  await http.close();
  await publisher.close?.();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
