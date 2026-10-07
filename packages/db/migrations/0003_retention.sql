-- =====================================================================
-- 0003 — Retención de datos de ubicación (minimización de datos personales)
-- Elimina posiciones y eventos de geocerca con más de 180 días.
-- Ajusta el intervalo según tu política de privacidad publicada.
-- =====================================================================

CREATE OR REPLACE FUNCTION octopus_apply_retention(retention interval DEFAULT '180 days')
RETURNS void LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  part record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM drop_chunks('positions', older_than => retention);
  ELSE
    -- Particiones diarias completas fuera de la ventana de retención.
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
END $fn$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('octopus-retention', '30 0 * * *', 'SELECT public.octopus_apply_retention()');
  ELSE
    RAISE WARNING 'pg_cron no disponible: ejecuta SELECT octopus_apply_retention() a diario.';
  END IF;
END $$;
