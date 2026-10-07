-- =====================================================================
-- 0002 — Teléfonos con consentimiento, clientes con acceso por vehículo,
--        comandos a dispositivos y Row Level Security.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Teléfonos (Android / iOS) que comparten ubicación desde el navegador
-- ---------------------------------------------------------------------
CREATE TYPE device_kind AS ENUM ('gps', 'phone');

ALTER TABLE devices
  ADD COLUMN kind device_kind NOT NULL DEFAULT 'gps',
  -- SHA-256 del token de vinculación (el token en claro nunca se guarda).
  ADD COLUMN tracking_token_hash text UNIQUE,
  -- Consentimiento vigente de la persona que porta el teléfono.
  ADD COLUMN consent_at timestamptz,
  ADD COLUMN consent_name text,
  ADD COLUMN consent_user_agent text,
  ADD COLUMN consent_revoked_at timestamptz;

-- Registro auditable de consentimientos (otorgado / revocado).
CREATE TABLE consent_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action      text NOT NULL CHECK (action IN ('granted', 'revoked')),
  holder_name text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_log_device_idx ON consent_log (device_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Usuarios: aceptación de términos y cambio de contraseña obligatorio
-- ---------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN terms_accepted_at timestamptz,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

-- Vehículos visibles para usuarios "cliente" (rol viewer). Un cliente solo
-- ve las unidades que el administrador le asigna.
CREATE TABLE user_vehicle_access (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id  uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vehicle_id)
);
CREATE INDEX user_vehicle_access_tenant_idx ON user_vehicle_access (tenant_id);

-- ---------------------------------------------------------------------
-- Comandos a dispositivos (cola con estado)
-- ---------------------------------------------------------------------
CREATE TYPE command_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'cancelled');

CREATE TABLE device_commands (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id     uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  type          text NOT NULL,
  params        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        command_status NOT NULL DEFAULT 'pending',
  result        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  completed_at  timestamptz
);
CREATE INDEX device_commands_device_idx ON device_commands (device_id, created_at DESC);
CREATE INDEX device_commands_pending_idx ON device_commands (device_id) WHERE status = 'pending';

-- ---------------------------------------------------------------------
-- Row Level Security en todas las tablas: sin políticas, nadie accede vía
-- APIs públicas (p. ej. PostgREST de Supabase). La app usa un rol propio
-- con BYPASSRLS.
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','users','memberships','devices','vehicles','positions',
    'device_last_positions','geofences','device_geofence_states','geofence_events','consent_log',
    'user_vehicle_access','device_commands','_migrations']
  LOOP
    CONTINUE WHEN to_regclass(t) IS NULL;
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN feature_not_supported THEN
      -- Hipertablas comprimidas de TimescaleDB no admiten RLS.
      RAISE NOTICE 'RLS no aplicable a %: %', t, SQLERRM;
    END;
  END LOOP;
  -- Particiones nativas existentes de positions (las nuevas lo activan al crearse).
  FOR t IN SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
           WHERE i.inhparent = 'positions'::regclass LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
