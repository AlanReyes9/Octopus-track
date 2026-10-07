/**
 * Datos de demostración: empresa, usuario admin, 3 dispositivos/vehículos
 * y una geocerca. Idempotente.
 *   Usuario: demo@octopus.track / demo1234
 */
import bcrypt from "bcryptjs";
import { createDb } from "./client";
import { devices, memberships, tenants, users, vehicles } from "./schema";
import { sql as dsql } from "drizzle-orm";

const DEMO = [
  { imei: "860000000000001", name: "GPS Camión 01", vehicle: "Camión 01", plate: "ABC-123", color: "#2563eb" },
  { imei: "860000000000002", name: "GPS Furgoneta 02", vehicle: "Furgoneta 02", plate: "XYZ-987", color: "#16a34a" },
  { imei: "860000000000003", name: "GPS Moto 03", vehicle: "Moto 03", plate: "MT-456", color: "#dc2626" },
];

async function main() {
  const { db, sql } = createDb({ max: 1 });
  try {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Empresa Demo", slug: "demo" })
      .onConflictDoUpdate({ target: tenants.slug, set: { name: "Empresa Demo" } })
      .returning();
    const [user] = await db
      .insert(users)
      .values({ email: "demo@octopus.track", name: "Admin Demo", passwordHash: await bcrypt.hash("demo1234", 10) })
      .onConflictDoUpdate({ target: users.email, set: { name: "Admin Demo" } })
      .returning();
    await db.insert(memberships).values({ userId: user!.id, tenantId: tenant!.id, role: "owner" }).onConflictDoNothing();

    for (const d of DEMO) {
      const [device] = await db
        .insert(devices)
        .values({ tenantId: tenant!.id, imei: d.imei, name: d.name, protocol: "tcp-text" })
        .onConflictDoUpdate({ target: devices.imei, set: { name: d.name } })
        .returning();
      await db
        .insert(vehicles)
        .values({ tenantId: tenant!.id, deviceId: device!.id, name: d.vehicle, plate: d.plate, color: d.color })
        .onConflictDoNothing();
    }

    // Geocerca de ejemplo: Zócalo CDMX (zona del simulador)
    await db.execute(dsql`
      INSERT INTO geofences (tenant_id, name, color, area)
      SELECT ${tenant!.id}, 'Centro Histórico', '#f97316',
             ST_GeomFromText('POLYGON((-99.1400 19.4280, -99.1260 19.4280, -99.1260 19.4380, -99.1400 19.4380, -99.1400 19.4280))', 4326)::geography
      WHERE NOT EXISTS (SELECT 1 FROM geofences WHERE tenant_id = ${tenant!.id} AND name = 'Centro Histórico')
    `);
    console.log("✓ seed completo — demo@octopus.track / demo1234");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
