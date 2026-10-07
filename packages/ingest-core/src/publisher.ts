import { Redis } from "ioredis";
import { COMMANDS_CHANNEL, tenantChannel, type LiveMessage } from "@octopus/telemetry";

/** Abstracción de salida en vivo: el pipeline no conoce Redis directamente. */
export interface LivePublisher {
  publish(message: LiveMessage): Promise<void>;
  /** Notifica al servicio de ingesta que hay un comando nuevo. */
  notifyCommand(commandId: string): Promise<void>;
  close?(): Promise<void>;
}

export const noopPublisher: LivePublisher = { publish: async () => {}, notifyCommand: async () => {} };

export function createRedisPublisher(url: string): LivePublisher {
  const redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  redis.on("error", (err) => console.error("[redis] error:", err.message));
  return {
    async publish(message) {
      await redis.publish(tenantChannel(message.tenantId), JSON.stringify(message));
    },
    async notifyCommand(commandId) {
      await redis.publish(COMMANDS_CHANNEL, commandId);
    },
    async close() {
      await redis.quit();
    },
  };
}

/** Publicador por variable de entorno REDIS_URL; sin ella no publica (modo polling). */
export function publisherFromEnv(): LivePublisher {
  return process.env.REDIS_URL ? createRedisPublisher(process.env.REDIS_URL) : noopPublisher;
}
