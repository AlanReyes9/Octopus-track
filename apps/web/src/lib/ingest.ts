import "server-only";
import { getDb } from "@octopus/db";
import {
  createAutomation,
  createCommandStore,
  createNotifier,
  createFcmSender,
  createPipeline,
  fcmFromEnv,
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
    });
    g.__octopusServices = { publisher, commands, notifier, pipeline };
  }
  return g.__octopusServices;
}

/** Pipeline compartido para los webhooks de ingesta servidos desde Vercel. */
export function getPipeline(): Pipeline {
  return services().pipeline;
}
