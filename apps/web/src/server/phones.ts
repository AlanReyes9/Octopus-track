import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, consentLog, devices, eq, getDb, isNull, tenants } from "@octopus/db";
import { createDeviceWithUnit } from "./fleet";

/**
 * Teléfonos (Android/iOS) que comparten su ubicación desde el navegador.
 * El token de vinculación se entrega una sola vez; en BD solo queda su hash.
 */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function newToken() {
  return randomBytes(24).toString("base64url");
}

export async function createPhoneDevice(
  tenantId: string,
  input: { name: string; phone?: string | null; color: string; icon: string },
) {
  const token = newToken();
  const device = await createDeviceWithUnit(tenantId, {
    kind: "phone",
    protocol: "phone",
    imei: `PH-${randomBytes(6).toString("hex").toUpperCase()}`,
    name: input.name,
    phone: input.phone ?? null,
    trackingTokenHash: hashToken(token),
    color: input.color,
    icon: input.icon,
  });
  return { device, token };
}

/** Genera un enlace nuevo e invalida el anterior (y el consentimiento previo). */
export async function regeneratePhoneToken(tenantId: string, deviceId: string) {
  const token = newToken();
  const rows = await getDb()
    .update(devices)
    .set({ trackingTokenHash: hashToken(token), consentAt: null, consentName: null, consentRevokedAt: null })
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId), eq(devices.kind, "phone")))
    .returning({ id: devices.id });
  return rows[0] ? token : null;
}

export async function findPhoneByToken(token: string) {
  if (!token || token.length < 20 || token.length > 64) return null;
  const [row] = await getDb()
    .select({
      id: devices.id,
      tenantId: devices.tenantId,
      imei: devices.imei,
      name: devices.name,
      consentAt: devices.consentAt,
      consentName: devices.consentName,
      consentRevokedAt: devices.consentRevokedAt,
      company: tenants.name,
    })
    .from(devices)
    .innerJoin(tenants, eq(tenants.id, devices.tenantId))
    .where(and(eq(devices.trackingTokenHash, hashToken(token)), eq(devices.kind, "phone")))
    .limit(1);
  return row ?? null;
}

export type PhoneDevice = NonNullable<Awaited<ReturnType<typeof findPhoneByToken>>>;

export const hasActiveConsent = (d: Pick<PhoneDevice, "consentAt" | "consentRevokedAt">) =>
  Boolean(d.consentAt && !d.consentRevokedAt);

export async function grantConsent(device: PhoneDevice, holderName: string, userAgent: string | null) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(devices)
      .set({ consentAt: new Date(), consentName: holderName, consentUserAgent: userAgent, consentRevokedAt: null })
      .where(eq(devices.id, device.id));
    await tx.insert(consentLog).values({
      deviceId: device.id,
      tenantId: device.tenantId,
      action: "granted",
      holderName,
      userAgent,
    });
  });
}

export async function revokeConsent(device: PhoneDevice, userAgent: string | null) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(devices)
      .set({ consentRevokedAt: new Date() })
      .where(and(eq(devices.id, device.id), isNull(devices.consentRevokedAt)));
    await tx.insert(consentLog).values({
      deviceId: device.id,
      tenantId: device.tenantId,
      action: "revoked",
      holderName: device.consentName,
      userAgent,
    });
  });
}

export function pairingUrl(origin: string, token: string) {
  // El token va en el fragmento (#): el navegador no lo envía en la petición
  // de la página, así que no queda en registros de servidores ni proxies.
  return `${origin}/rastreo#t=${token}`;
}
