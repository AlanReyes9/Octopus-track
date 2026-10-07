import "server-only";
import { getDb } from "@octopus/db";
import { createPipeline, publisherFromEnv, type Pipeline } from "@octopus/ingest-core";

const g = globalThis as unknown as { __octopusPipeline?: Pipeline };

/** Pipeline compartido para el webhook de ingesta servido desde Vercel. */
export function getPipeline(): Pipeline {
  g.__octopusPipeline ??= createPipeline({ db: getDb(), publisher: publisherFromEnv() });
  return g.__octopusPipeline;
}
