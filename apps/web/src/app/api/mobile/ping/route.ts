import { json } from "@/lib/api";
import { vapidFromEnv } from "@octopus/ingest-core";

export const dynamic = "force-dynamic";

/** Comprobación pública de que la URL corresponde a un servidor Octopus Track. */
export function GET() {
  return json({ app: "octopus-track", api: 1, push: Boolean(vapidFromEnv()) });
}
