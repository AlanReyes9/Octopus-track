import { describe, expect, it } from "vitest";
import {
  decodeOsmAnd,
  decodeTcpTextLine,
  decodeJsonGateway,
  encodeTcpCommand,
  encodeTcpTextLine,
  parseTcpCommandAck,
  haversineMeters,
  LineFramer,
  TelemetryParseError,
} from "./index";

describe("decodeJsonGateway (gateway HTTP JSON)", () => {
  it("normaliza un forward de posición (nudos -> km/h)", () => {
    const e = decodeJsonGateway({
      position: {
        deviceId: 7,
        fixTime: "2026-10-07T12:00:00.000+00:00",
        latitude: 19.432607812345,
        longitude: -99.133209,
        altitude: 2240,
        speed: 10,
        course: 370,
        valid: true,
        attributes: { ignition: true, sat: 9, batteryLevel: 80 },
      },
      device: { id: 7, uniqueId: "356938035643809", name: "Camión 1" },
    });
    expect(e.imei).toBe("356938035643809");
    expect(e.latitude).toBe(19.4326078);
    expect(e.speedKmh).toBeCloseTo(18.52);
    expect(e.course).toBe(10);
    expect(e.ignition).toBe(true);
    expect(e.satellites).toBe(9);
    expect(e.attributes.batteryLevel).toBe(80);
    expect(e.timestamp.toISOString()).toBe("2026-10-07T12:00:00.000Z");
  });

  it("rechaza coordenadas fuera de rango", () => {
    expect(() =>
      decodeJsonGateway({ position: { latitude: 91, longitude: 0, fixTime: Date.now() }, device: { uniqueId: "1" } }),
    ).toThrow(TelemetryParseError);
  });
});

describe("decodeOsmAnd", () => {
  it("lee parámetros de query", () => {
    const e = decodeOsmAnd(new URLSearchParams("id=123456&lat=-34.6&lon=-58.38&timestamp=1791374400&speed=5&batt=77"));
    expect(e.imei).toBe("123456");
    expect(e.timestamp.getTime()).toBe(1791374400 * 1000);
    expect(e.attributes.batt).toBe("77");
  });
});

describe("protocolo TCP de texto", () => {
  it("ida y vuelta encode/decode", () => {
    const line = encodeTcpTextLine({
      imei: "861234567890123",
      timestamp: new Date("2026-10-07T10:00:00Z"),
      latitude: 40.4167754,
      longitude: -3.7037902,
      speedKmh: 55.5,
      course: 90,
      ignition: false,
    });
    const e = decodeTcpTextLine(line);
    expect(e.latitude).toBe(40.4167754);
    expect(e.longitude).toBe(-3.7037902);
    expect(e.speedKmh).toBe(55.5);
    expect(e.ignition).toBe(false);
    expect(e.altitude).toBeNull();
  });

  it("LineFramer reensambla tramas fragmentadas", () => {
    const f = new LineFramer();
    expect(f.push("$POS,1,2026-")).toEqual([]);
    expect(f.push("10-07T00:00:00Z,1,2*\r\n$POS,2")).toEqual(["$POS,1,2026-10-07T00:00:00Z,1,2*"]);
  });
});

it("haversine ~111 km por grado de latitud", () => {
  expect(haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111195, -2);
});

describe("comandos TCP", () => {
  it("codifica sin permitir inyección de separadores", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(encodeTcpCommand(id, "message", { text: "hola,*mundo\r\n$POS" })).toBe(`$CMD,${id},message,text=hola  mundo   POS*`);
  });
  it("interpreta ACKs", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(parseTcpCommandAck(`$CMDACK,${id},OK*`)).toEqual({ id, ok: true, message: null });
    expect(parseTcpCommandAck(`$CMDACK,${id},ERR,sin relé*`)).toEqual({ id, ok: false, message: "sin relé" });
    expect(parseTcpCommandAck("$POS,1,2,3,4*")).toBeNull();
  });
});
