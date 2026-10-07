-- =====================================================================
-- 0007 — Acciones de geocerca y notificaciones push
-- =====================================================================

-- Reglas: al entrar/salir de una geocerca → notificación push o comando.
CREATE TABLE IF NOT EXISTS geofence_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  geofence_id    uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  trigger        text NOT NULL CHECK (trigger IN ('enter', 'exit', 'both')),
  -- NULL = cualquier unidad
  device_id      uuid REFERENCES devices(id) ON DELETE CASCADE,
  action         text NOT NULL CHECK (action IN ('notify', 'command')),
  command_type   text,
  params         jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled        boolean NOT NULL DEFAULT true,
  last_fired_at  timestamptz,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (action <> 'command' OR command_type IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS geofence_rules_geofence_idx ON geofence_rules (geofence_id) WHERE enabled;

-- Suscripciones Web Push (VAPID) por usuario y navegador.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_tenant_idx ON push_subscriptions (tenant_id);

ALTER TABLE geofence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
