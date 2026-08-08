-- ==========================================
-- UPDATE: FASE PASAJEROS Y PROMOCIONES
-- ==========================================

-- 1. Modificar tabla promociones para soportar lógica de negocio de descuentos
ALTER TABLE public.promociones 
ADD COLUMN IF NOT EXISTS tipo_descuento TEXT CHECK (tipo_descuento IN ('porcentaje', 'fijo')) DEFAULT 'porcentaje',
ADD COLUMN IF NOT EXISTS valor_descuento NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dias_aplicacion JSONB DEFAULT '[]'::jsonb, -- Ej: ["Lunes", "Viernes"]
ADD COLUMN IF NOT EXISTS horario_inicio TIME,
ADD COLUMN IF NOT EXISTS horario_fin TIME,
ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
ADD COLUMN IF NOT EXISTS fecha_fin DATE,
ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;

-- 2. Modificar tabla viajes para reflejar método de pago y promociones aplicadas
ALTER TABLE public.viajes
ADD COLUMN IF NOT EXISTS promocion_id UUID REFERENCES public.promociones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS monto_descontado NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'mp')) DEFAULT 'efectivo',
ADD COLUMN IF NOT EXISTS precio_original NUMERIC(10, 2);

-- Actualizar precios originales en viajes pasados
UPDATE public.viajes SET precio_original = precio WHERE precio_original IS NULL;
