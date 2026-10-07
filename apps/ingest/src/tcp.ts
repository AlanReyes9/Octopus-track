import net from "node:net";
import type { CommandStore, Pipeline } from "@octopus/ingest-core";
import {
  decodeTcpTextLine,
  encodeTcpCommand,
  LineFramer,
  parseTcpCommandAck,
  TelemetryParseError,
} from "@octopus/telemetry";

/**
 * Servidor TCP para equipos que hablan el protocolo de texto `$POS`.
 * - Cada conexión tiene su propio framer; las tramas se procesan en serie
 *   para conservar el orden cronológico por equipo.
 * - Mantiene un registro dispositivo → socket para entregar comandos
 *   (`$CMD`) y recibir sus confirmaciones (`$CMDACK`).
 */
export function buildTcpServer(
  pipeline: Pipeline,
  commands: CommandStore,
  opts: { idleTimeoutMs?: number } = {},
) {
  const connections = new Map<string, net.Socket>(); // deviceId → socket

  async function deliverPending(deviceId: string) {
    const socket = connections.get(deviceId);
    if (!socket || socket.destroyed) return;
    for (const cmd of await commands.pendingForDevice(deviceId)) {
      socket.write(encodeTcpCommand(cmd.id, cmd.type, cmd.params) + "\r\n");
      await commands.mark(cmd.id, "sent");
    }
  }

  const server = net.createServer((socket) => {
    const framer = new LineFramer();
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    let deviceId: string | null = null;
    let queue = Promise.resolve();
    socket.setEncoding("utf8");
    socket.setTimeout(opts.idleTimeoutMs ?? 10 * 60_000);
    socket.on("timeout", () => socket.end());
    socket.on("error", (err) => console.warn(`[tcp] ${peer}: ${err.message}`));
    socket.on("close", () => {
      if (deviceId && connections.get(deviceId) === socket) connections.delete(deviceId);
    });

    socket.on("data", (chunk: string) => {
      for (const line of framer.push(chunk)) {
        queue = queue.then(async () => {
          try {
            const ack = parseTcpCommandAck(line);
            if (ack) {
              await commands.mark(ack.id, ack.ok ? "delivered" : "failed", ack.message);
              return;
            }
            const event = decodeTcpTextLine(line);
            const result = await pipeline.process(event);
            if (result.status === "stored" || result.status === "duplicate") {
              socket.write(`$ACK,${event.imei}\r\n`);
              if (deviceId !== result.device.id) {
                deviceId = result.device.id;
                connections.set(deviceId, socket);
              }
              await deliverPending(deviceId);
            } else {
              socket.write(`$NAK,${result.status}\r\n`);
            }
          } catch (err) {
            const reason = err instanceof TelemetryParseError ? err.message : "error interno";
            if (!(err instanceof TelemetryParseError)) console.error(`[tcp] ${peer}:`, err);
            if (!socket.destroyed) socket.write(`$NAK,${reason}\r\n`);
          }
        });
      }
    });
  });

  /** Llamado cuando la web encola un comando (vía Redis). */
  async function onCommandQueued(commandId: string) {
    const cmd = await commands.byId(commandId);
    if (cmd && connections.has(cmd.deviceId)) await deliverPending(cmd.deviceId);
  }

  return { server, onCommandQueued, connectedCount: () => connections.size };
}
