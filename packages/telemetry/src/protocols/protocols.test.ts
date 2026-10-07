import { describe, expect, it } from "vitest";
import { normalize } from "../normalize";
import { buildGt06Packet, crc16X25, detectProtocol, handlerById } from "./index";

const hex = (s: string) => Buffer.from(s.replace(/\s+/g, ""), "hex");
const near = (a: number, b: number, eps = 1e-5) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("GT06", () => {
  const gt06 = handlerById("gt06")!;

  it("CRC-ITU del paquete de login de la especificación", () => {
    const login = hex("78780D01012345678901234500018CDD0D0A");
    expect(crc16X25(login, 2, login.length - 4)).toBe(0x8cdd);
  });

  it("login: IMEI y respuesta", () => {
    const login = hex("78780D01012345678901234500018CDD0D0A");
    expect(detectProtocol(login)?.id).toBe("gt06");
    const r = gt06.decode(login, {});
    expect(r.identify).toBe("123456789012345");
    expect(r.reply?.toString("hex")).toBe(buildGt06Packet(0x01, 1).toString("hex"));
  });

  it("posición 0x12 de la especificación", () => {
    const f = hex("78781F120B081D112E10CC027AC7EB0C46584900148F01CC00287D001FB8000380810D0A");
    const { frames, rest } = gt06.frame(Buffer.concat([f, f.subarray(0, 5)]));
    expect(frames).toHaveLength(1);
    expect(rest).toHaveLength(5);
    const p = gt06.decode(frames[0]!, { imei: "1" }).positions[0]!;
    expect((p.timestamp as Date).toISOString()).toBe("2011-08-29T17:46:16.000Z");
    near(p.latitude as number, 23.1116683);
    near(p.longitude as number, 114.4092850);
    expect(p.satellites).toBe(12);
    expect(p.course).toBe(143);
    expect(p.valid).toBe(true);
  });

  it("codifica comandos 0x80 con CRC válido", () => {
    const cmd = gt06.encodeCommand!("engineStop", {}, { imei: "1", commandId: "x", ref: 7 })!;
    expect(cmd.subarray(0, 2).toString("hex")).toBe("7878");
    expect(cmd[3]).toBe(0x80);
    expect(cmd.toString("latin1")).toContain("RELAY,1#");
    const crc = cmd.readUInt16BE(cmd.length - 4);
    expect(crc16X25(cmd, 2, cmd.length - 4)).toBe(crc);
  });
});

describe("Teltonika", () => {
  const t = handlerById("teltonika")!;

  it("saludo con IMEI", () => {
    const hello = hex("000F333536333037303432343431303133");
    expect(detectProtocol(hello)?.id).toBe("teltonika");
    const r = t.decode(t.frame(hello).frames[0]!, {});
    expect(r.identify).toBe("356307042441013");
    expect(r.reply).toEqual(Buffer.from([1]));
  });

  it("Codec 8 de la documentación pública", () => {
    const avl = hex(
      "000000000000003608010000016B40D8EA30010000000000000000000000000000000105021503010101425E0F01F10000601A014E0000000000000000010000C7CF",
    );
    const { frames } = t.frame(avl);
    expect(frames).toHaveLength(1);
    const r = t.decode(frames[0]!, { imei: "1" });
    expect(r.positions).toHaveLength(1);
    expect((r.positions[0]!.timestamp as Date).toISOString()).toBe("2019-06-10T10:04:46.000Z");
    expect(r.positions[0]!.attributes).toMatchObject({ io21: 3, io1: 1, io66: 0x5e0f, io241: 0x601a, io78: "0" });
    expect(r.reply?.readUInt32BE(0)).toBe(1);
  });

  it("descarta tramas con CRC incorrecto (sin ACK)", () => {
    const bad = hex(
      "000000000000003608010000016B40D8EA30010000000000000000000000000000000105021503010101425E0F01F10000601A014E0000000000000000010000C7C0",
    );
    expect(t.decode(bad, {}).reply).toBeUndefined();
  });
});

describe("protocolos de texto", () => {
  it("TK103", () => {
    const s = Buffer.from("(087073803649BR00080612A2232.9828N11404.9297E000.0022828000.0000000000L00000000)");
    const h = detectProtocol(s)!;
    expect(h.id).toBe("tk103");
    const r = h.decode(h.frame(s).frames[0]!, {});
    expect(r.identify).toBe("087073803649");
    const p = r.positions[0]!;
    expect((p.timestamp as Date).toISOString()).toBe("2008-06-12T02:28:28.000Z");
    near(p.latitude as number, 22.5497133);
    near(p.longitude as number, 114.0821617);
  });

  it("GPS103 (Coban): login, latido y posición", () => {
    const h = handlerById("gps103")!;
    expect(detectProtocol(Buffer.from("##,imei:359586015829802,A;"))?.id).toBe("gps103");
    expect(h.decode(Buffer.from("##,imei:359586015829802,A;"), {}).reply?.toString()).toBe("LOAD");
    expect(h.decode(Buffer.from("359586015829802;"), {}).reply?.toString()).toBe("ON");
    const r = h.decode(
      Buffer.from("imei:359587010124900,tracker,0809231929,13554900601,F,112909.397,A,2234.4669,N,11354.3287,E,0.11,;"),
      {},
    );
    expect(r.identify).toBe("359587010124900");
    const p = r.positions[0]!;
    expect((p.timestamp as Date).toISOString()).toBe("2008-09-23T11:29:09.000Z");
    near(p.latitude as number, 22.5744483);
    near(p.longitude as number, 113.9054783);
    expect(h.encodeCommand!("engineStop", {}, { imei: "359587010124900", commandId: "x", ref: 1 })!.toString()).toBe(
      "**,imei:359587010124900,J;",
    );
  });

  it("H02 (Sinotrack)", () => {
    const s = Buffer.from("*HQ,4106012736,V1,224434,A,2232.8196,N,11406.0218,E,000.00,000,170315,FBFFBBFF,460,00,10342,4283#");
    const h = detectProtocol(s)!;
    expect(h.id).toBe("h02");
    const r = h.decode(h.frame(s).frames[0]!, {});
    expect(r.identify).toBe("4106012736");
    expect((r.positions[0]!.timestamp as Date).toISOString()).toBe("2015-03-17T22:44:34.000Z");
    near(r.positions[0]!.latitude as number, 22.5469933);
  });

  it("Meitrack AAA", () => {
    const s = Buffer.from(
      "$$A138,862170013556541,AAA,35,7.092076,79.960473,140412104954,A,10,9,57,275,1,14,5783799,7403612,413|1|F6E0|3933,0000,000B|0009||02D8|0122,*EE\r\n",
    );
    const h = detectProtocol(s)!;
    expect(h.id).toBe("meitrack");
    const r = h.decode(h.frame(s).frames[0]!, {});
    const e = normalize({ imei: r.identify, ...r.positions[0]! }, "meitrack");
    expect(e.imei).toBe("862170013556541");
    expect(e.latitude).toBe(7.092076);
    expect(e.speedKmh).toBe(57);
    expect(e.timestamp.toISOString()).toBe("2014-04-12T10:49:54.000Z");
  });

  it("$POS propio", () => {
    const s = Buffer.from("$POS,861234567890123,2026-10-07T10:00:00Z,40.4167754,-3.7037902,55.5,90,,,1*\r\n");
    expect(detectProtocol(s)?.id).toBe("tcp-text");
  });

  it("protocolo desconocido", () => {
    expect(detectProtocol(Buffer.from("GET / HTTP/1.1\r\n"))).toBeNull();
  });
});
