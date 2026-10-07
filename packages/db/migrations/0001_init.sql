-- =====================================================================
-- Octopus Track — esquema inicial
-- PostgreSQL 15+ con PostGIS (geocercas). Telemetría: hipertablas TimescaleDB
-- si la extensión existe; si no (p. ej. Supabase), particionado nativo diario.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- En Supabase las extensiones viven en el esquema "extensions".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
  ELSE
    CREATE EXTENSION IF NOT EXISTS postgis;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
  ELSE
    RAISE NOTICE 'TimescaleDB no disponible: se usará particionado nativo de PostgreSQL por día.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Multi-empresa (tenants) y autenticación
-- ---------------------------------------------------------------------
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  name           text NOT NULL,
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'viewer');

CREATE TABLE memberships (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role        membership_role NOT NULL DEFAULT 'viewer',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);
CREATE INDEX memberships_tenant_idx ON memberships (tenant_id);

-- ---------------------------------------------------------------------
-- 2. Dispositivos (IMEI) y vehículos
-- ---------------------------------------------------------------------
CREATE TABLE devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- IMEI / uniqueId: único globalmente porque enruta la ingesta al tenant.
  imei          varchar(32) NOT NULL UNIQUE,
  name          text NOT NULL,
  protocol      text NOT NULL DEFAULT 'gateway',
  phone         text,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX devices_tenant_idx ON devices (tenant_id);

CREATE TABLE vehicles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id   uuid UNIQUE REFERENCES devices(id) ON DELETE SET NULL,
  name        text NOT NULL,
  plate       text,
  color       varchar(9) NOT NULL DEFAULT '#7c3aed',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_tenant_idx ON vehicles (tenant_id);

-- ---------------------------------------------------------------------
-- 3. Telemetría temporal (hipertabla particionada por tiempo)
-- ---------------------------------------------------------------------
-- Con TimescaleDB: hipertabla (sección 5). Sin TimescaleDB (p. ej. Supabase):
-- tabla particionada por RANGE(time) con una partición por día.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    EXECUTE $sql$ CREATE TABLE positions (
  time        timestamptz NOT NULL,
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,
  latitude    DECIMAL(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude   DECIMAL(10, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  altitude    real,
  speed_kmh   real,
  course      real,
  satellites  smallint,
  ignition    boolean,
  valid       boolean NOT NULL DEFAULT true,
  attributes  jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, time)
    ) $sql$;
  ELSE
    EXECUTE $sql$ CREATE TABLE positions (
  time        timestamptz NOT NULL,
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,
  latitude    DECIMAL(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude   DECIMAL(10, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  altitude    real,
  speed_kmh   real,
  course      real,
  satellites  smallint,
  ignition    boolean,
  valid       boolean NOT NULL DEFAULT true,
  attributes  jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, time)
    ) PARTITION BY RANGE (time) $sql$;
    EXECUTE 'CREATE TABLE positions_default PARTITION OF positions DEFAULT';
  END IF;
END $do$;
CREATE INDEX positions_tenant_time_idx ON positions (tenant_id, time DESC);

-- Última posición conocida por dispositivo (lecturas rápidas del mapa en vivo).
CREATE TABLE device_last_positions (
  device_id   uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,
  time        timestamptz NOT NULL,
  latitude    DECIMAL(10, 7) NOT NULL,
  longitude   DECIMAL(10, 7) NOT NULL,
  altitude    real,
  speed_kmh   real,
  course      real,
  ignition    boolean,
  attributes  jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX device_last_positions_tenant_idx ON device_last_positions (tenant_id);

-- ---------------------------------------------------------------------
-- 4. Geocercas (PostGIS)
-- ---------------------------------------------------------------------
CREATE TABLE geofences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       varchar(9) NOT NULL DEFAULT '#f97316',
  area        geography(Polygon, 4326) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geofences_tenant_idx ON geofences (tenant_id);
CREATE INDEX geofences_area_gix ON geofences USING GIST (area);

-- Estado actual dentro/fuera para detectar transiciones.
CREATE TABLE device_geofence_states (
  device_id    uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  geofence_id  uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  since        timestamptz NOT NULL,
  PRIMARY KEY (device_id, geofence_id)
);

CREATE TYPE geofence_event_type AS ENUM ('enter', 'exit');

CREATE TABLE geofence_events (
  time         timestamptz NOT NULL,
  device_id    uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL,
  geofence_id  uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  type         geofence_event_type NOT NULL,
  latitude     DECIMAL(10, 7) NOT NULL,
  longitude    DECIMAL(10, 7) NOT NULL,
  PRIMARY KEY (device_id, geofence_id, time, type)
);
CREATE INDEX geofence_events_tenant_time_idx ON geofence_events (tenant_id, time DESC);

-- ---------------------------------------------------------------------
-- 5. Configuración TimescaleDB
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('positions', by_range('time', INTERVAL '1 day'));
    PERFORM create_hypertable('geofence_events', by_range('time', INTERVAL '7 days'));

    -- Compresión columnar de chunks antiguos, segmentada por dispositivo.
    ALTER TABLE positions SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'device_id',
      timescaledb.compress_orderby = 'time DESC'
    );
    PERFORM add_compression_policy('positions', INTERVAL '7 days');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 6. Particiones nativas (sin TimescaleDB): se crean por adelantado cada día.
--    La retención (borrado de datos antiguos) está en 0003_retention.sql.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION octopus_maintain_partitions(days_ahead int DEFAULT 7)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  d date;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    RETURN; -- TimescaleDB gestiona sus chunks
  END IF;
  FOR i IN -1..days_ahead LOOP
    d := (now() AT TIME ZONE 'UTC')::date + i;
    IF to_regclass(format('positions_%s', to_char(d, 'YYYYMMDD'))) IS NULL THEN
      BEGIN
        EXECUTE format(
          'CREATE TABLE %I PARTITION OF positions FOR VALUES FROM (%L) TO (%L)',
          'positions_' || to_char(d, 'YYYYMMDD'), d::timestamp AT TIME ZONE 'UTC', (d + 1)::timestamp AT TIME ZONE 'UTC');
        -- Las particiones no heredan RLS: se activa en cada una.
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'positions_' || to_char(d, 'YYYYMMDD'));
      EXCEPTION WHEN others THEN
        -- p. ej. filas de ese día ya en positions_default: se quedan ahí.
        RAISE WARNING 'no se pudo crear la partición de %: %', d, SQLERRM;
      END;
    END IF;
  END LOOP;
END $fn$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM octopus_maintain_partitions();
    -- Programación diaria con pg_cron cuando está disponible (Supabase lo incluye).
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      PERFORM cron.schedule('octopus-partitions', '15 0 * * *', 'SELECT public.octopus_maintain_partitions()');
    ELSE
      RAISE WARNING 'pg_cron no disponible: ejecuta SELECT octopus_maintain_partitions() a diario.';
    END IF;
  END IF;
END $$;
