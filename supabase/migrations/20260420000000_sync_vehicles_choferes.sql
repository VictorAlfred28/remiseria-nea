-- =========================================================
-- MIGRACIÓN: SINCRONIZACIÓN AUTOMÁTICA VEHICLES ↔ CHOFERES
-- =========================================================
-- Triggers para mantener sincronizadas las tablas vehicles y choferes
-- Fuente de verdad: vehicles (driver_id es la asignación oficial)
-- Sincronización: Cuando driver_id cambia, se actualiza choferes.vehiculo automáticamente

-- =========================================================
-- 1. TRIGGER: Actualizar choferes cuando se asigna/desasigna vehículo
-- =========================================================

-- Función trigger para AFTER INSERT/UPDATE en vehicles
CREATE OR REPLACE FUNCTION public.sync_vehicle_assignment_to_choferes()
RETURNS TRIGGER AS $$
DECLARE
    vehiculo_nombre TEXT;
BEGIN
    -- Si driver_id es NULL → el vehículo no tiene chofer asignado
    IF NEW.driver_id IS NULL THEN
        -- Si antes tenía chofer, limpiar su registro en choferes
        IF OLD.driver_id IS NOT NULL THEN
            UPDATE public.choferes
            SET vehiculo = 'Busca vehículo'
            WHERE usuario_id = OLD.driver_id
              AND organizacion_id = NEW.organizacion_id;
        END IF;
    ELSE
        -- Construir nombre del vehículo: marca + modelo
        vehiculo_nombre := NEW.marca || ' ' || NEW.modelo;
        
        -- Si el driver_id cambió de alguien a otro
        IF OLD.driver_id IS NOT NULL AND OLD.driver_id != NEW.driver_id THEN
            -- Limpiar chofer anterior
            UPDATE public.choferes
            SET vehiculo = 'Busca vehículo'
            WHERE usuario_id = OLD.driver_id
              AND organizacion_id = NEW.organizacion_id;
        END IF;
        
        -- Actualizar chofer nuevo con el vehículo asignado
        UPDATE public.choferes
        SET vehiculo = vehiculo_nombre,
            patente = NEW.patente
        WHERE usuario_id = NEW.driver_id
          AND organizacion_id = NEW.organizacion_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para AFTER INSERT
CREATE TRIGGER trg_sync_vehicle_insert_choferes
AFTER INSERT ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.sync_vehicle_assignment_to_choferes();

-- Crear trigger para AFTER UPDATE
CREATE TRIGGER trg_sync_vehicle_update_choferes
AFTER UPDATE ON public.vehicles
FOR EACH ROW
WHEN (
    OLD.driver_id IS DISTINCT FROM NEW.driver_id
    OR OLD.marca IS DISTINCT FROM NEW.marca
    OR OLD.modelo IS DISTINCT FROM NEW.modelo
    OR OLD.patente IS DISTINCT FROM NEW.patente
)
EXECUTE FUNCTION public.sync_vehicle_assignment_to_choferes();

-- =========================================================
-- 2. TRIGGER: Limpiar chofer cuando se elimina vehículo
-- =========================================================

CREATE OR REPLACE FUNCTION public.cleanup_driver_on_vehicle_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.driver_id IS NOT NULL THEN
        UPDATE public.choferes
        SET vehiculo = 'Busca vehículo'
        WHERE usuario_id = OLD.driver_id
          AND organizacion_id = OLD.organizacion_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_driver_on_vehicle_delete
AFTER DELETE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_driver_on_vehicle_delete();

-- =========================================================
-- 3. ÍNDICE para queries rápidas de sincronización
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_choferes_usuario_id 
ON public.choferes(usuario_id, organizacion_id);

-- =========================================================
-- 4. Sincronizar datos HISTÓRICOS (ejecutar solo en deploy)
-- =========================================================
-- Actualizar todos los choferes existentes con su vehículo asignado actual
UPDATE public.choferes c
SET vehiculo = v.marca || ' ' || v.modelo,
    patente = v.patente
FROM public.vehicles v
WHERE c.usuario_id = v.driver_id
  AND c.organizacion_id = v.organizacion_id
  AND c.vehiculo != (v.marca || ' ' || v.modelo);

-- Actualizar choferes que deberían estar en "Busca vehículo"
UPDATE public.choferes c
SET vehiculo = 'Busca vehículo'
WHERE NOT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.driver_id = c.usuario_id
      AND v.organizacion_id = c.organizacion_id
)
AND c.vehiculo != 'Busca vehículo';
