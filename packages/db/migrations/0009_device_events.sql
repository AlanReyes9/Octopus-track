-- =====================================================================
-- Eventos de equipo: cambios de estado (motor, conexión, batería) que no
-- son posiciones ni entradas/salidas de geocerca. Alimentan el apartado
-- "Eventos" de la web y las apps, y disparan notificaciones push.
-- =====================================================================

CREATE TYPE device_event_type AS ENUM ('ignition_on', 'ignition_off', 'offline', 'online', 'low_battery');

CREATE TABLE device_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time        timestamptz NOT NULL DEFAULT now(),
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,
  type        device_event_type NOT NULL,
  message     text NOT NULL,
  attributes  jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX device_events_tenant_time_idx ON device_events (tenant_id, time DESC);
CREATE INDEX device_events_device_time_idx ON device_events (device_id, time DESC);

ALTER TABLE device_events ENABLE ROW LEVEL SECURITY;

-- Se suma a la misma política de retención que ya aplica a geofence_events (0003).
CREATE OR REPLACE FUNCTION octopus_apply_retention(retention interval DEFAULT '180 days')
RETURNS void LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  part record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM drop_chunks('positions', older_than => retention);
  ELSE
    FOR part IN
      SELECT c.relname FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      WHERE i.inhparent = 'positions'::regclass AND c.relname ~ '^positions_[0-9]{8}$'
        AND to_date(substr(c.relname, 11), 'YYYYMMDD') < (now() - retention)::date
    LOOP
      EXECUTE format('DROP TABLE %I', part.relname);
    END LOOP;
    DELETE FROM positions_default WHERE time < now() - retention;
  END IF;
  DELETE FROM geofence_events WHERE time < now() - retention;
  DELETE FROM device_commands WHERE created_at < now() - retention;
  DELETE FROM device_events WHERE time < now() - retention;
END $fn$;
