-- Actualización Remisería v2.0 - Migración de Base de Datos

-- 1. Actualizar estados en la tabla viajes
ALTER TABLE public.viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;
ALTER TABLE public.viajes ADD CONSTRAINT viajes_estado_check 
CHECK (estado IN ('REQUESTED', 'QUOTED', 'ACCEPTED', 'ASSIGNED', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'NO_SHOW', 'solicitado', 'asignado', 'en_camino', 'finalizado', 'cancelado', 'en_puerta'));

-- 2. Agregar nuevas columnas de timestamps a viajes
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- 3. Agregar columnas de cálculo a viajes
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 0;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS wait_cost NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS final_price NUMERIC(10, 2);
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS calificacion INTEGER;

-- 4. Actualizar tabla tariff_configs con nuevas reglas
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS wait_free_minutes INTEGER DEFAULT 5;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS wait_block_minutes INTEGER DEFAULT 10;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS wait_block_price NUMERIC(10, 2) DEFAULT 2500.00;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS wait_price_per_minute NUMERIC(10, 2) DEFAULT 250.00;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS trunk_price NUMERIC(10, 2) DEFAULT 2500.00;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS dynamic_multiplier NUMERIC(3, 2) DEFAULT 1.00;

-- 5. Opcional: Migrar estados existentes (si es necesario para compatibilidad inmediata)
UPDATE public.viajes SET estado = 'REQUESTED' WHERE estado = 'solicitado';
UPDATE public.viajes SET estado = 'ASSIGNED' WHERE estado = 'asignado';
UPDATE public.viajes SET estado = 'ARRIVED' WHERE estado = 'en_puerta';
UPDATE public.viajes SET estado = 'FINISHED' WHERE estado = 'finalizado';
UPDATE public.viajes SET estado = 'CANCELLED' WHERE estado = 'cancelado';
UPDATE public.viajes SET estado = 'STARTED' WHERE estado = 'en_camino';
