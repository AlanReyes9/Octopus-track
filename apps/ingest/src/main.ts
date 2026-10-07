import { createDb } from "@octopus/db";
import { createPipeline, publisherFromEnv } from "@octopus/ingest-core";
import { buildHttpServer } from "./http";
import { buildTcpServer } from "./tcp";

const httpPort = Number(process.env.INGEST_HTTP_PORT ?? process.env.PORT ?? 4000);
const tcpPort = Number(process.env.INGEST_TCP_PORT ?? 5023);

const { db, sql } = createDb({ max: Number(process.env.DB_POOL_MAX ?? 10) });
const publisher = publisherFromEnv();
const pipeline = createPipeline({ db, publisher });

const http = buildHttpServer(pipeline, { ingestToken: process.env.INGEST_TOKEN });
const tcp = buildTcpServer(pipeline);

await http.listen({ port: httpPort, host: "0.0.0.0" });
tcp.listen(tcpPort, "0.0.0.0", () => console.log(`[tcp] escuchando en :${tcpPort}`));

async function shutdown() {
  console.log("cerrando ingesta…");
  tcp.close();
  await http.close();
  await publisher.close?.();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
