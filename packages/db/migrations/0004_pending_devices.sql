-- =====================================================================
-- 0004 — Equipos detectados aún no registrados
-- Cuando un rastreador se conecta con un IMEI desconocido se anota aquí su
-- protocolo para que la web lo reconozca al darlo de alta (búsqueda por
-- IMEI exacto; nunca se listan para evitar filtrar datos entre empresas).
-- =====================================================================
CREATE TABLE IF NOT EXISTS pending_devices (
  imei         varchar(32) PRIMARY KEY,
  protocol     text NOT NULL,
  remote_addr  text,
  first_seen   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now(),
  messages     integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS pending_devices_last_seen_idx ON pending_devices (last_seen);
ALTER TABLE pending_devices ENABLE ROW LEVEL SECURITY;
