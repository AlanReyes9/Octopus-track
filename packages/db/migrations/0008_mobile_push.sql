-- =====================================================================
-- 0008 — Tokens de notificaciones push de la app Android (FCM)
-- =====================================================================
CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  platform    text NOT NULL DEFAULT 'android',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_push_tokens_tenant_idx ON mobile_push_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS mobile_push_tokens_user_idx ON mobile_push_tokens (user_id);
ALTER TABLE mobile_push_tokens ENABLE ROW LEVEL SECURITY;
