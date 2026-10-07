/**
 * Web Push sin dependencias externas:
 *  - Cifrado del mensaje: RFC 8291 (aes128gcm, RFC 8188).
 *  - Autenticación del servidor: VAPID, RFC 8292 (JWT ES256).
 * Funciona con los servicios push de Chrome, Firefox, Edge y Safari (iOS 16.4+ como PWA).
 */
import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // base64url, 65 bytes (P-256 sin comprimir)
  auth: string; // base64url, 16 bytes
}

export interface VapidKeys {
  publicKey: string; // base64url (65 bytes)
  privateKey: string; // base64url (32 bytes)
  subject: string; // mailto: o https:
}

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

/** Genera un par de claves VAPID (P-256). */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), fromB64u(pub.x!), fromB64u(pub.y!)]);
  return { publicKey: b64u(raw), privateKey: priv.d! };
}

/** Cifra la carga útil para una suscripción (RFC 8291). */
export function encryptPayload(payload: Buffer, sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">, salt = randomBytes(16)) {
  const uaPublic = fromB64u(sub.p256dh);
  const authSecret = fromB64u(sub.auth);
  const ecdh = createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const ecdhSecret = ecdh.computeSecret(uaPublic);

  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, body]);
}

/** Cabecera Authorization VAPID para el origen del endpoint (RFC 8292). */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): string {
  const aud = new URL(endpoint).origin;
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })));
  const pub = fromB64u(keys.publicKey);
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: keys.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk",
  });
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${keys.publicKey}`;
}

export type PushResult = "sent" | "gone" | "error";

/** Envía una notificación. "gone" = suscripción caducada (borrarla). */
export async function sendWebPush(sub: PushSubscriptionKeys, payload: unknown, keys: VapidKeys): Promise<PushResult> {
  const body = encryptPayload(Buffer.from(JSON.stringify(payload)), sub);
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: "86400",
        urgency: "high",
        authorization: vapidAuthorization(sub.endpoint, keys),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "error";
  } catch {
    return "error";
  }
}

export function vapidFromEnv(): VapidKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:soporte@octopus-track.app" };
}
