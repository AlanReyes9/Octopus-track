import { Redis } from "ioredis";
import { tenantChannel, type LiveMessage } from "@octopus/telemetry";

/** Abstracción de salida en vivo: el pipeline no conoce Redis directamente. */
export interface LivePublisher {
  publish(message: LiveMessage): Promise<void>;
  close?(): Promise<void>;
}

export const noopPublisher: LivePublisher = { publish: async () => {} };

export function createRedisPublisher(url: string): LivePublisher {
  const redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  redis.on("error", (err) => console.error("[redis] error:", err.message));
  return {
    async publish(message) {
      await redis.publish(tenantChannel(message.tenantId), JSON.stringify(message));
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
