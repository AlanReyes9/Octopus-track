import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildAssertion, createFcmSender, fcmFromEnv } from "./fcm";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const account = { project_id: "octopus-test", client_email: "svc@octopus-test.iam.gserviceaccount.com", private_key: privateKey };

describe("FCM", () => {
  it("lee la cuenta de servicio en JSON o base64", () => {
    const json = JSON.stringify(account);
    expect(fcmFromEnv({ FCM_SERVICE_ACCOUNT: json })?.projectId).toBe("octopus-test");
    expect(fcmFromEnv({ FCM_SERVICE_ACCOUNT: Buffer.from(json).toString("base64") })?.clientEmail).toBe(account.client_email);
    expect(fcmFromEnv({ FCM_SERVICE_ACCOUNT: "basura" })).toBeNull();
    expect(fcmFromEnv({})).toBeNull();
  });

  it("firma la aserción RS256 verificable", () => {
    const cfg = fcmFromEnv({ FCM_SERVICE_ACCOUNT: JSON.stringify(account) })!;
    const jwt = buildAssertion(cfg, 1_800_000_000_000);
    const [h, c, s] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toMatchObject({
      iss: account.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    expect(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });

  it("obtiene token OAuth2 una vez y envía el mensaje de datos", async () => {
    const cfg = fcmFromEnv({ FCM_SERVICE_ACCOUNT: JSON.stringify(account) })!;
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
      return new Response("{}", { status: 200 });
    });
    const sender = createFcmSender(cfg, fetchMock as unknown as typeof fetch);
    expect(await sender.send("device-token", { title: "Hola", body: "Mundo", url: "/dashboard?device=1" })).toBe("sent");
    expect(await sender.send("device-token-2", { title: "Otra", body: "Vez" })).toBe("sent");
    expect(calls.filter((c) => c.url.includes("oauth2"))).toHaveLength(1); // token en caché
    const msg = JSON.parse(String(calls[1]!.init.body)).message;
    expect(calls[1]!.url).toBe("https://fcm.googleapis.com/v1/projects/octopus-test/messages:send");
    expect((calls[1]!.init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(msg).toMatchObject({ token: "device-token", data: { title: "Hola", body: "Mundo", url: "/dashboard?device=1" }, android: { priority: "HIGH" } });
  });

  it("marca como 'gone' los tokens no registrados", async () => {
    const cfg = fcmFromEnv({ FCM_SERVICE_ACCOUNT: JSON.stringify(account) })!;
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("oauth2") ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 })) : new Response("{}", { status: 404 }),
    );
    expect(await createFcmSender(cfg, fetchMock as unknown as typeof fetch).send("x", { title: "a", body: "b" })).toBe("gone");
  });
});
