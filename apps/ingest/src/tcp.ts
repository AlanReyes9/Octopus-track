import net from "node:net";
import type { Pipeline } from "@octopus/ingest-core";
import { decodeTcpTextLine, LineFramer, TelemetryParseError } from "@octopus/telemetry";

/**
 * Servidor TCP para equipos que hablan el protocolo de texto `$POS`.
 * Cada conexión tiene su propio framer; las tramas se procesan en serie
 * para conservar el orden cronológico por equipo.
 */
export function buildTcpServer(pipeline: Pipeline, opts: { idleTimeoutMs?: number } = {}) {
  const server = net.createServer((socket) => {
    const framer = new LineFramer();
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    let queue = Promise.resolve();
    socket.setEncoding("utf8");
    socket.setTimeout(opts.idleTimeoutMs ?? 10 * 60_000);
    socket.on("timeout", () => socket.end());
    socket.on("error", (err) => console.warn(`[tcp] ${peer}: ${err.message}`));

    socket.on("data", (chunk: string) => {
      for (const line of framer.push(chunk)) {
        queue = queue.then(async () => {
          try {
            const event = decodeTcpTextLine(line);
            const result = await pipeline.process(event);
            if (result.status === "stored" || result.status === "duplicate") {
              socket.write(`$ACK,${event.imei}\r\n`);
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
  return server;
}
