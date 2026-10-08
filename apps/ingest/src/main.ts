import { Redis } from "ioredis";
import { createDb } from "@octopus/db";
import {
  createAutomation,
  createCommandStore,
  createNotifier,
  createFcmSender,
  createPipeline,
  detectConnectivityChanges,
  fcmFromEnv,
  insertConnectivityEvents,
  publisherFromEnv,
  vapidFromEnv,
} from "@octopus/ingest-core";
import { COMMANDS_CHANNEL } from "@octopus/telemetry";
import { buildHttpServer } from "./http";
import { buildTcpServer } from "./tcp";

const httpPort = Number(process.env.INGEST_HTTP_PORT ?? process.env.PORT ?? 4000);
const tcpPort = Number(process.env.INGEST_TCP_PORT ?? 5023);

const { db, sql } = createDb({ max: Number(process.env.DB_POOL_MAX ?? 10) });
const publisher = publisherFromEnv();
// Los comandos que disparan las geocercas se entregan directamente a los
// equipos conectados a este proceso (enlace tardío: los servidores TCP se crean después).
let deliverLocal: (id: string) => Promise<void> = async () => {};
const commands = createCommandStore(db, publisher, {
  onTcpCommand: async (id) => {
    await deliverLocal(id);
    await publisher.notifyCommand(id).catch(() => {});
  },
});
const fcmConfig = fcmFromEnv();
const notifier = createNotifier(db, { vapid: vapidFromEnv(), fcm: fcmConfig ? createFcmSender(fcmConfig) : null });
const pipeline = createPipeline({
  db,
  publisher,
  onGeofenceTransitions: createAutomation({ db, commands, notifier }),
  onDeviceEvents: async (device, events) => {
    for (const e of events) {
      await notifier.notifyDevice(device.tenantId, device.id, {
        title: e.message,
        body: "Toca para ver la unidad en el mapa",
        url: `/dashboard?device=${device.id}`,
        tag: `ev-${device.id}-${e.type}`,
      });
    }
  },
});

// Este proceso está siempre corriendo (a diferencia de los endpoints serverless
// de la web), así que es la mejor fuente para detectar equipos que dejaron de
// reportar sin esperar al cron diario. No estorba si el cron también lo hace.
const connectivityInterval = setInterval(async () => {
  try {
    const events = await detectConnectivityChanges(db);
    if (events.length === 0) return;
    await insertConnectivityEvents(db, events);
    for (const e of events) {
      await notifier.notifyDevice(e.tenantId, e.deviceId, {
        title: e.message,
        body: "Toca para ver la unidad en el mapa",
        url: `/dashboard?device=${e.deviceId}`,
        tag: `ev-${e.deviceId}-${e.type}`,
      });
    }
  } catch (err) {
    console.error("[connectivity]", err);
  }
}, 2 * 60_000);

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

deliverLocal = async (id) => {
  for (const t of [tcp, ...dedicated.map((d) => d.srv)]) await t.onCommandQueued(id);
};

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
  clearInterval(connectivityInterval);
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
