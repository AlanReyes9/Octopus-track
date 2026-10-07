/**
 * Esquema Drizzle (espejo tipado de migrations/*.sql).
 * Las migraciones SQL son la fuente de verdad porque incluyen
 * configuración de TimescaleDB y PostGIS que Drizzle no modela.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
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
export const deviceKind = pgEnum("device_kind", ["gps", "phone"]);
export const commandStatus = pgEnum("command_status", ["pending", "sent", "delivered", "failed", "cancelled"]);

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
  termsAcceptedAt: ts("terms_accepted_at"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
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
  protocol: text("protocol").notNull().default("gateway"),
  phone: text("phone"),
  kind: deviceKind("kind").notNull().default("gps"),
  trackingTokenHash: text("tracking_token_hash").unique(),
  consentAt: ts("consent_at"),
  consentName: text("consent_name"),
  consentUserAgent: text("consent_user_agent"),
  consentRevokedAt: ts("consent_revoked_at"),
  lastSeenAt: ts("last_seen_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").unique().references(() => devices.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  plate: text("plate"),
  color: varchar("color", { length: 9 }).notNull().default("#7c3aed"),
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

// ---------------------------------------------------------------- acceso de clientes
export const userVehicleAccess = pgTable(
  "user_vehicle_access",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.vehicleId] })],
);

// ---------------------------------------------------------------- consentimiento (teléfonos)
export const consentLog = pgTable("consent_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  action: text("action").$type<"granted" | "revoked">().notNull(),
  holderName: text("holder_name"),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- comandos
export const deviceCommands = pgTable("device_commands", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  params: jsonb("params").$type<Record<string, string | number | boolean>>().notNull().default(sql`'{}'::jsonb`),
  status: commandStatus("status").notNull().default("pending"),
  result: text("result"),
  createdAt: ts("created_at").notNull().defaultNow(),
  sentAt: ts("sent_at"),
  completedAt: ts("completed_at"),
});

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type CommandStatus = (typeof commandStatus.enumValues)[number];
export type DeviceKind = (typeof deviceKind.enumValues)[number];
export type MembershipRole = (typeof membershipRole.enumValues)[number];
