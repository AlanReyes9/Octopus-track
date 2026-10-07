/**
 * Esquema Drizzle (espejo tipado de migrations/*.sql).
 * Las migraciones SQL son la fuente de verdad porque incluyen
 * configuración de TimescaleDB y PostGIS que Drizzle no modela.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** DECIMAL(10, 7) — precisión obligatoria para lat/lng. */
const coord = (name: string) => numeric(name, { precision: 10, scale: 7 });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** geography(Polygon,4326). Se lee/escribe vía ST_AsGeoJSON / ST_GeomFromGeoJSON. */
const geographyPolygon = customType<{ data: string }>({
  dataType: () => "geography(Polygon, 4326)",
});

export const membershipRole = pgEnum("membership_role", ["owner", "admin", "viewer"]);
export const geofenceEventType = pgEnum("geofence_event_type", ["enter", "exit"]);

// ---------------------------------------------------------------- tenants / auth
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("viewer"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tenantId] }), index("memberships_tenant_idx").on(t.tenantId)],
);

// ---------------------------------------------------------------- devices / vehicles
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  imei: varchar("imei", { length: 32 }).notNull().unique(),
  name: text("name").notNull(),
  protocol: text("protocol").notNull().default("traccar"),
  phone: text("phone"),
  lastSeenAt: ts("last_seen_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").unique().references(() => devices.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  plate: text("plate"),
  color: varchar("color", { length: 9 }).notNull().default("#2563eb"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- telemetry (hypertables)
export const positions = pgTable(
  "positions",
  {
    time: ts("time").notNull(),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull(),
    latitude: coord("latitude").notNull(),
    longitude: coord("longitude").notNull(),
    altitude: real("altitude"),
    speedKmh: real("speed_kmh"),
    course: real("course"),
    satellites: smallint("satellites"),
    ignition: boolean("ignition"),
    valid: boolean("valid").notNull().default(true),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.time] })],
);

export const deviceLastPositions = pgTable("device_last_positions", {
  deviceId: uuid("device_id").primaryKey().references(() => devices.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull(),
  time: ts("time").notNull(),
  latitude: coord("latitude").notNull(),
  longitude: coord("longitude").notNull(),
  altitude: real("altitude"),
  speedKmh: real("speed_kmh"),
  course: real("course"),
  ignition: boolean("ignition"),
  attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
});

// ---------------------------------------------------------------- geofences (PostGIS)
export const geofences = pgTable("geofences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: varchar("color", { length: 9 }).notNull().default("#f97316"),
  area: geographyPolygon("area").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const deviceGeofenceStates = pgTable(
  "device_geofence_states",
  {
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    geofenceId: uuid("geofence_id").notNull().references(() => geofences.id, { onDelete: "cascade" }),
    since: ts("since").notNull(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.geofenceId] })],
);

export const geofenceEvents = pgTable(
  "geofence_events",
  {
    time: ts("time").notNull(),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull(),
    geofenceId: uuid("geofence_id").notNull().references(() => geofences.id, { onDelete: "cascade" }),
    type: geofenceEventType("type").notNull(),
    latitude: coord("latitude").notNull(),
    longitude: coord("longitude").notNull(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.geofenceId, t.time, t.type] })],
);

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type MembershipRole = (typeof membershipRole.enumValues)[number];
