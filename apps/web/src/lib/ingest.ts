import "server-only";
import { getDb } from "@octopus/db";
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
  type CommandStore,
  type LivePublisher,
  type Notifier,
  type Pipeline,
} from "@octopus/ingest-core";

interface Services {
  publisher: LivePublisher;
  commands: CommandStore;
  notifier: Notifier;
  pipeline: Pipeline;
}

const g = globalThis as unknown as { __octopusServices?: Services };

/** Servicios compartidos (pipeline, comandos, notificaciones) del lado web. */
export function services(): Services {
  if (!g.__octopusServices) {
    const db = getDb();
    const publisher = publisherFromEnv();
    const commands = createCommandStore(db, publisher);
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
    g.__octopusServices = { publisher, commands, notifier, pipeline };
  }
  return g.__octopusServices;
}

/** Pipeline compartido para los webhooks de ingesta servidos desde Vercel. */
export function getPipeline(): Pipeline {
  return services().pipeline;
}

/**
 * Detecta equipos que dejaron de reportar (o que volvieron) y notifica.
 * La llama el cron de mantenimiento; si además corre apps/ingest por separado,
 * ese proceso la llama con más frecuencia (no son excluyentes).
 */
export async function checkConnectivity(): Promise<number> {
  const { notifier } = services();
  const db = getDb();
  const events = await detectConnectivityChanges(db);
  if (events.length === 0) return 0;
  await insertConnectivityEvents(db, events);
  for (const e of events) {
    await notifier.notifyDevice(e.tenantId, e.deviceId, {
      title: e.message,
      body: "Toca para ver la unidad en el mapa",
      url: `/dashboard?device=${e.deviceId}`,
      tag: `ev-${e.deviceId}-${e.type}`,
    });
  }
  return events.length;
}
