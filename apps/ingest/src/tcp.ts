import net from "node:net";
import {
  notePendingDevice,
  syncDeviceProtocol,
  type CommandStore,
  type Pipeline,
} from "@octopus/ingest-core";
import type { Database } from "@octopus/db";
import {
  detectProtocol,
  handlerById,
  normalize,
  TelemetryParseError,
  type ProtocolHandler,
} from "@octopus/telemetry";

const MAX_BUFFER = 64 * 1024;

interface Session {
  socket: net.Socket;
  handler: ProtocolHandler | null;
  imei?: string;
  deviceId?: string;
  protocolSynced: boolean;
  refCounter: number;
  /** ref numérica → id del comando (para protocolos que la devuelven). */
  sentByRef: Map<number, string>;
  /** Comandos enviados sin confirmar, en orden. */
  sentQueue: string[];
}

/**
 * Servidor TCP multiprotocolo. Con `protocol` fijo atiende solo ese
 * protocolo (puerto dedicado); sin él, lo detecta por los primeros bytes.
 */
export function buildTcpServer(
  pipeline: Pipeline,
  commands: CommandStore,
  db: Database,
  opts: { protocol?: string; idleTimeoutMs?: number } = {},
) {
  const connections = new Map<string, Session>(); // deviceId → sesión
  const forced = opts.protocol ? handlerById(opts.protocol) ?? null : null;
  if (opts.protocol && !forced) throw new Error(`Protocolo TCP desconocido: ${opts.protocol}`);

  async function deliverPending(session: Session) {
    if (!session.deviceId || !session.imei || !session.handler || session.socket.destroyed) return;
    for (const cmd of await commands.pendingForDevice(session.deviceId)) {
      const ref = ++session.refCounter;
      const payload = session.handler.encodeCommand?.(cmd.type, cmd.params, {
        imei: session.imei,
        commandId: cmd.id,
        ref,
      });
      if (!payload) {
        await commands.mark(cmd.id, "failed", `El protocolo ${session.handler.id} no admite este comando`);
        continue;
      }
      session.socket.write(payload);
      session.sentByRef.set(ref, cmd.id);
      session.sentQueue.push(cmd.id);
      await commands.mark(cmd.id, "sent");
    }
  }

  async function handleFrame(session: Session, frame: Buffer, peer: string) {
    const handler = session.handler!;
    const result = handler.decode(frame, { imei: session.imei });
    if (result.identify) session.imei = result.identify;
    if (result.reply) session.socket.write(result.reply);

    if (result.commandResponse) {
      const r = result.commandResponse;
      const id =
        r.commandId ?? (r.ref !== undefined ? session.sentByRef.get(r.ref) : undefined) ?? session.sentQueue[0];
      if (id) {
        session.sentQueue = session.sentQueue.filter((x) => x !== id);
        await commands.mark(id, r.ok ? "delivered" : "failed", r.text);
      }
    }

    for (const raw of result.positions) {
      if (!session.imei) continue; // posición antes del login: se ignora
      let event;
      try {
        event = normalize({ imei: session.imei, ...raw }, handler.id);
      } catch (err) {
        if (err instanceof TelemetryParseError) continue;
        throw err;
      }
      const res = await pipeline.process(event);
      if (res.status === "unknown_device") {
        await notePendingDevice(db, session.imei, handler.id, peer);
        continue;
      }
      if (res.status === "stored" || res.status === "duplicate") {
        if (session.deviceId !== res.device.id) {
          session.deviceId = res.device.id;
          connections.set(res.device.id, session);
        }
        if (!session.protocolSynced) {
          session.protocolSynced = true;
          await syncDeviceProtocol(db, res.device.id, handler.id);
        }
      }
    }

    // Login/latido sin posición: también sirve para entregar comandos.
    if (session.imei && !session.deviceId && result.identify) {
      const known = await pipeline.resolve(session.imei);
      if (known) {
        session.deviceId = known.id;
        connections.set(known.id, session);
      } else {
        await notePendingDevice(db, session.imei, handler.id, peer);
      }
    }
    if (session.deviceId) await deliverPending(session);
  }

  const server = net.createServer((socket) => {
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    const session: Session = {
      socket,
      handler: forced,
      protocolSynced: false,
      refCounter: Math.floor(Math.random() * 1000),
      sentByRef: new Map(),
      sentQueue: [],
    };
    let buffer: Buffer = Buffer.alloc(0);
    let queue = Promise.resolve();
    socket.setTimeout(opts.idleTimeoutMs ?? 10 * 60_000);
    socket.on("timeout", () => socket.end());
    socket.on("error", (err) => console.warn(`[tcp] ${peer}: ${err.message}`));
    socket.on("close", () => {
      if (session.deviceId && connections.get(session.deviceId) === session) connections.delete(session.deviceId);
    });

    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_BUFFER) {
        socket.destroy();
        return;
      }
      if (!session.handler) {
        session.handler = detectProtocol(buffer);
        if (!session.handler) {
          if (buffer.length >= 64) {
            console.warn(`[tcp] ${peer}: protocolo no reconocido (${buffer.subarray(0, 16).toString("hex")})`);
            socket.destroy();
          }
          return;
        }
        console.log(`[tcp] ${peer}: protocolo ${session.handler.id}`);
      }
      const { frames, rest } = session.handler.frame(buffer);
      buffer = Buffer.from(rest);
      for (const frame of frames) {
        queue = queue
          .then(() => handleFrame(session, frame, peer))
          .catch((err) => console.error(`[tcp] ${peer} (${session.handler?.id}):`, err));
      }
    });
  });

  /** Llamado cuando la web encola un comando (vía Redis). */
  async function onCommandQueued(commandId: string) {
    const cmd = await commands.byId(commandId);
    const session = cmd && connections.get(cmd.deviceId);
    if (session) await deliverPending(session);
  }

  return { server, onCommandQueued, connectedCount: () => connections.size };
}
