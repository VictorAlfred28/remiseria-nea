-- 1. Agregar columnas de integridad
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS orphan BOOLEAN DEFAULT false;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS identity_fixed BOOLEAN DEFAULT false;

-- 2. Backfill de datos históricos (Intentar vincular viajes huérfanos con el cliente si existe)
UPDATE viajes v
SET cliente_id = u.id, identity_fixed = true
FROM usuarios u
WHERE v.cliente_id IS NULL 
  AND v.origen->>'cliente_telefono' = u.telefono;

-- Para los que sigan huérfanos
UPDATE viajes 
SET orphan = true 
WHERE cliente_id IS NULL AND orphan = false;

-- 3. Normalización Gradual (FASE 2)
UPDATE viajes 
SET estado = 'REQUESTED' 
WHERE estado = 'solicitado';

-- Opcional para normalizar historicos en ingles si quedó alguno 'requested'
UPDATE viajes
SET estado = 'REQUESTED'
WHERE estado = 'requested';
