import { HttpError, json, parseBody, withAuth } from "@/lib/api";
import { gpsDeviceCreateSchema, phoneDeviceSchema } from "@/lib/schemas";
import { createDeviceWithUnit, listDevices } from "@/server/fleet";
import { createPhoneDevice, pairingUrl } from "@/server/phones";

export const GET = withAuth(async (_req, { session }) => json(await listDevices(session.tenantId)), { manage: true });

export const POST = withAuth(
  async (req, { session }) => {
    const body = await req.json().catch(() => {
      throw new HttpError(400, "JSON inválido");
    });
    if (body?.kind === "phone") {
      const input = phoneDeviceSchema.parse(body);
      const { device, token } = await createPhoneDevice(session.tenantId, input);
      const { trackingTokenHash: _hash, ...safe } = device;
      return json({ device: safe, pairingUrl: pairingUrl(new URL(req.url).origin, token) }, 201);
    }
    const input = gpsDeviceCreateSchema.parse(body);
    const device = await createDeviceWithUnit(session.tenantId, { ...input, kind: "gps" });
    const { trackingTokenHash: _hash, ...safe } = device;
    return json({ device: safe }, 201);
  },
  { manage: true },
);
