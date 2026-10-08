import { commandsFor, getProtocol } from "@octopus/telemetry";
import { json, withAuth } from "@/lib/api";

/** Comandos disponibles para un protocolo (fuente única: packages/telemetry). */
export const GET = withAuth(
  async (req) => {
    const protocol = new URL(req.url).searchParams.get("protocol") ?? "";
    return json({
      protocol: getProtocol(protocol)?.name ?? protocol,
      commands: commandsFor(protocol).map(({ type, label, description, dangerous, params }) => ({
        type,
        label,
        description,
        dangerous: Boolean(dangerous),
        params: params ?? [],
      })),
    });
  },
  { manage: true },
);
