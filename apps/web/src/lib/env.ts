/** Variables mínimas para que la web funcione. */
export const REQUIRED_ENV = ["DATABASE_URL", "AUTH_SECRET"] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]);
}
