import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encryptPayload, generateVapidKeys, vapidAuthorization } from "./webpush";

const hmac = (k: Buffer, d: Buffer) => createHmac("sha256", k).update(d).digest();

/** Descifrado del lado del navegador (RFC 8291) para validar el formato. */
function uaDecrypt(body: Buffer, uaEcdh: ReturnType<typeof createECDH>, auth: Buffer) {
  const salt = body.subarray(0, 16);
  const idlen = body[20]!;
  const asPublic = body.subarray(21, 21 + idlen);
  const ct = body.subarray(21 + idlen);
  const uaPublic = uaEcdh.getPublicKey();
  const ecdhSecret = uaEcdh.computeSecret(asPublic);
  const prkKey = hmac(auth, ecdhSecret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  expect(plain.at(-1)).toBe(2); // delimitador del último registro
  return { text: plain.subarray(0, -1).toString(), rs: body.readUInt32BE(16) };
}

describe("Web Push", () => {
  it("cifra con aes128gcm descifrable por el agente de usuario", () => {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const auth = randomBytes(16);
    const payload = JSON.stringify({ title: "Salida de geocerca", body: "Camión 01 salió de Almacén" });
    const body = encryptPayload(Buffer.from(payload), {
      p256dh: ua.getPublicKey().toString("base64url"),
      auth: auth.toString("base64url"),
    });
    const r = uaDecrypt(body, ua, auth);
    expect(r.text).toBe(payload);
    expect(r.rs).toBe(4096);
  });

  it("firma VAPID ES256 verificable con la clave pública", () => {
    const keys = { ...generateVapidKeys(), subject: "mailto:test@example.com" };
    const auth = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", keys, 1_800_000_000_000);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(auth)!;
    const claims = JSON.parse(Buffer.from(m[2]!, "base64url").toString());
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: 1_800_043_200, sub: "mailto:test@example.com" });
    const pub = Buffer.from(keys.publicKey, "base64url");
    const key = createPublicKey({
      key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") },
      format: "jwk",
    });
    const ok = verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(m[3]!, "base64url"));
    expect(ok).toBe(true);
    expect(m[4]).toBe(keys.publicKey);
  });
});
