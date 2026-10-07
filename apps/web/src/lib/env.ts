import { isDbConfigured } from "@octopus/db";

/** Variables mínimas para que la web funcione. */
export const REQUIRED_ENV = ["AUTH_SECRET"] as const;

export function missingEnv(): string[] {
  const missing: string[] = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (!isDbConfigured()) missing.push("DATABASE_URL");
  return missing;
}
