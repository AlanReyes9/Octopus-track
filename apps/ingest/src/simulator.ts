/**
 * Simulador de flota: abre una conexión TCP por vehículo demo y envía
 * tramas `$POS` recorriendo un circuito alrededor del Centro Histórico (CDMX).
 *   pnpm simulate [-- --host localhost --port 5023 --interval 2000]
 */
import net from "node:net";
import { parseArgs } from "node:util";
import { encodeTcpTextLine } from "@octopus/telemetry";

const { values } = parseArgs({
  options: {
    host: { type: "string", default: "localhost" },
    port: { type: "string", default: process.env.INGEST_TCP_PORT ?? "5023" },
    interval: { type: "string", default: "2000" },
    imeis: { type: "string", default: "860000000000001,860000000000002,860000000000003" },
  },
});

// Circuito (lat, lon) que entra y sale de la geocerca demo.
const ROUTE: [number, number][] = [
  [19.4205, -99.1490], [19.4250, -99.1450], [19.4300, -99.1380], [19.4326, -99.1332],
  [19.4350, -99.1300], [19.4400, -99.1250], [19.4450, -99.1300], [19.4420, -99.1420],
  [19.4350, -99.1480], [19.4270, -99.1520],
];

function interpolate(t: number): { lat: number; lon: number; course: number } {
  const n = ROUTE.length;
  const i = Math.floor(t) % n;
  const f = t - Math.floor(t);
  const [aLat, aLon] = ROUTE[i]!;
  const [bLat, bLon] = ROUTE[(i + 1) % n]!;
  const course = ((Math.atan2(bLon - aLon, bLat - aLat) * 180) / Math.PI + 360) % 360;
  return { lat: aLat + (bLat - aLat) * f, lon: aLon + (bLon - aLon) * f, course };
}

const interval = Number(values.interval);
values.imeis!.split(",").forEach((imei, idx) => {
  let t = idx * 3.3;
  const speedStep = 0.08 + idx * 0.03;
  const socket = net.connect(Number(values.port), values.host!, () => {
    console.log(`[sim] ${imei} conectado`);
    setInterval(() => {
      t += speedStep;
      const p = interpolate(t);
      socket.write(
        encodeTcpTextLine({
          imei,
          timestamp: new Date(),
          latitude: p.lat,
          longitude: p.lon,
          speedKmh: 25 + Math.random() * 35,
          course: p.course,
          altitude: 2240,
          satellites: 8 + Math.floor(Math.random() * 5),
          ignition: true,
        }) + "\r\n",
      );
    }, interval);
  });
  socket.setEncoding("utf8");
  socket.on("data", (d: string) => d.includes("NAK") && console.warn(`[sim] ${imei}: ${d.trim()}`));
  socket.on("error", (e) => console.error(`[sim] ${imei}: ${e.message}`));
});
