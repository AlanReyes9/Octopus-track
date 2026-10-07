-- =====================================================================
-- 0006 — Icono de la unidad (auto, camión, moto, autobús...)
-- =====================================================================
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS icon varchar(20) NOT NULL DEFAULT 'car';
