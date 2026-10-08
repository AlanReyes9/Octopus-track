/**
 * Firebase Cloud Messaging (HTTP v1) sin dependencias: autenticación OAuth2
 * con cuenta de servicio (JWT RS256 firmado con `crypto`) y envío de mensajes
 * de datos. La app Android construye la notificación a partir de los datos,
 * igual que el service worker de la web.
 */
import { createSign } from "node:crypto";
import type { PushPayload } from "./notifications";

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** Lee la cuenta de servicio de FCM_SERVICE_ACCOUNT (JSON o JSON en base64). */
export function fcmFromEnv(env: Record<string, string | undefined> = process.env): FcmConfig | null {
  const raw = env.FCM_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const json = JSON.parse(text) as { project_id?: string; client_email?: string; private_key?: string };
    if (!json.project_id || !json.client_email || !json.private_key) return null;
    return { projectId: json.project_id, clientEmail: json.client_email, privateKey: json.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** JWT de aserción para el intercambio OAuth2 (RFC 7523). */
export function buildAssertion(cfg: FcmConfig, now = Date.now()): string {
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const iat = Math.floor(now / 1000);
  const claims = b64u(JSON.stringify({ iss: cfg.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(cfg.privateKey);
  return `${header}.${claims}.${b64u(signature)}`;
}

export type FcmResult = "sent" | "gone" | "error";

export function createFcmSender(cfg: FcmConfig, fetchImpl: typeof fetch = fetch) {
  let cached: { token: string; expires: number } | null = null;

  async function accessToken(): Promise<string> {
    if (cached && cached.expires > Date.now() + 60_000) return cached.token;
    const res = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: buildAssertion(cfg),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`OAuth2 de FCM respondió ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
    return cached.token;
  }

  async function send(token: string, payload: PushPayload): Promise<FcmResult> {
    try {
      const res = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${await accessToken()}` },
        body: JSON.stringify({
          message: {
            token,
            // Solo datos: la app arma la notificación (canal, icono, acción al tocar).
            data: {
              title: payload.title,
              body: payload.body,
              url: payload.url ?? "/dashboard",
              tag: payload.tag ?? "",
            },
            android: { priority: "HIGH", ttl: "86400s" },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return "sent";
      // 404 (UNREGISTERED) y 400 con token inválido: el token ya no sirve.
      if (res.status === 404) return "gone";
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: { details?: { errorCode?: string }[] } };
        if (body.error?.details?.some((d) => d.errorCode === "UNREGISTERED" || d.errorCode === "INVALID_ARGUMENT")) return "gone";
      }
      return "error";
    } catch {
      return "error";
    }
  }

  return { send };
}

export type FcmSender = ReturnType<typeof createFcmSender>;
