import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

export interface CreateDbOptions {
  url?: string;
  /** Conexiones máximas del pool. En serverless conviene un valor bajo. */
  max?: number;
}

/**
 * URL de conexión de la aplicación (pooler). Admite la variable que crea la
 * integración de Neon en Vercel con prefijo (octopus_DATABASE_URL), la de
 * Vercel/Neon sin prefijo y DATABASE_URL genérica.
 */
export function databaseUrl(): string | undefined {
  return process.env.octopus_DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || undefined;
}

/** URL directa (sin pooler) para migraciones. */
export function migrationUrl(): string | undefined {
  return (
    process.env.MIGRATION_DATABASE_URL ||
    process.env.octopus_DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

export function createDb(opts: CreateDbOptions = {}): { db: Database; sql: postgres.Sql } {
  const url = opts.url ?? databaseUrl();
  if (!url) throw new Error("No hay URL de base de datos (DATABASE_URL / octopus_DATABASE_URL)");
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
  return Boolean(databaseUrl());
}
