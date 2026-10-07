import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

export interface CreateDbOptions {
  url?: string;
  /** Conexiones máximas del pool. En serverless conviene un valor bajo. */
  max?: number;
}

export function createDb(opts: CreateDbOptions = {}): { db: Database; sql: postgres.Sql } {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida");
  const client = postgres(url, {
    max: opts.max ?? 10,
    // Compatible con poolers en modo transacción (PgBouncer / Supavisor).
    prepare: false,
    // numeric(10,7) se devuelve como string para no perder precisión.
  });
  return { db: drizzle(client, { schema }), sql: client };
}

const globalForDb = globalThis as unknown as { __octopusDb?: { db: Database; sql: postgres.Sql } };

/** Instancia singleton (reutilizada entre invocaciones calientes / HMR). */
export function getDb(): Database {
  if (!globalForDb.__octopusDb) {
    globalForDb.__octopusDb = createDb({ max: Number(process.env.DB_POOL_MAX ?? 5) });
  }
  return globalForDb.__octopusDb.db;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
