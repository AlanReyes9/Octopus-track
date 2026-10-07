-- =====================================================================
-- 0005 — Comandos predefinidos por empresa
-- Plantillas reutilizables (p. ej. "Cortar corriente GT06" = "RELAY,1#").
-- protocol NULL = disponible para cualquier protocolo que admita el tipo.
-- =====================================================================
CREATE TABLE IF NOT EXISTS command_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  protocol    text,
  type        text NOT NULL DEFAULT 'custom',
  params      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS command_templates_tenant_idx ON command_templates (tenant_id);
ALTER TABLE command_templates ENABLE ROW LEVEL SECURITY;
