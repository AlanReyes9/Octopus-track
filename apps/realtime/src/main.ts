/**
 * Gateway WebSocket de tiempo real.
 *
 *  Redis (PSUBSCRIBE tenant:*:live) ──► gateway ──► navegadores del tenant
 *
 * Los clientes se conectan con `?token=<JWT>` emitido por la web
 * (/api/realtime/token) y firmado con REALTIME_JWT_SECRET. El gateway es
 * stateless: se puede escalar horizontalmente, cada réplica recibe todo el
 * tráfico de Redis y lo reparte solo a sus sockets.
 */
import { createServer } from "node:http";
import { Redis } from "ioredis";
import { jwtVerify } from "jose";
import { WebSocket, WebSocketServer } from "ws";
import { TENANT_CHANNEL_PATTERN } from "@octopus/telemetry";

const port = Number(process.env.REALTIME_PORT ?? process.env.PORT ?? 4001);
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const secretValue = process.env.REALTIME_JWT_SECRET;
if (!secretValue) throw new Error("REALTIME_JWT_SECRET no está definida");
const secret = new TextEncoder().encode(secretValue);
const allowedOrigins = (process.env.REALTIME_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** tenantId → sockets conectados */
const rooms = new Map<string, Set<WebSocket>>();

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, tenants: rooms.size }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });

http.on("upgrade", async (req, socket, head) => {
  try {
    const origin = req.headers.origin;
    if (allowedOrigins.length && (!origin || !allowedOrigins.includes(origin))) throw new Error("origin");
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");
    if (!token) throw new Error("token");
    const { payload } = await jwtVerify(token, secret, { audience: "octopus-realtime" });
    const tenantId = payload.tid;
    if (typeof tenantId !== "string") throw new Error("tid");

    wss.handleUpgrade(req, socket, head, (ws) => {
      const room = rooms.get(tenantId) ?? new Set();
      room.add(ws);
      rooms.set(tenantId, room);
      ws.send(JSON.stringify({ type: "hello", tenantId }));

      let alive = true;
      ws.on("pong", () => (alive = true));
      const ping = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false;
        ws.ping();
      }, 30_000);

      ws.on("close", () => {
        clearInterval(ping);
        room.delete(ws);
        if (room.size === 0) rooms.delete(tenantId);
      });
    });
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

const sub = new Redis(redisUrl);
sub.on("error", (err) => console.error("[redis]", err.message));
await sub.psubscribe(TENANT_CHANNEL_PATTERN);
sub.on("pmessage", (_pattern, channel, message) => {
  const tenantId = channel.split(":")[1];
  const room = tenantId ? rooms.get(tenantId) : undefined;
  if (!room) return;
  for (const ws of room) if (ws.readyState === WebSocket.OPEN) ws.send(message);
});

http.listen(port, () => console.log(`[realtime] escuchando en :${port}`));

function shutdown() {
  wss.clients.forEach((ws) => ws.close(1001, "shutdown"));
  sub.disconnect();
  http.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
