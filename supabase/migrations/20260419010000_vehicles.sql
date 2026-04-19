-- ==========================================
-- MIGRACIÓN: TABLA VEHICLES + ROL TITULAR
-- ==========================================

-- 1. Garantizar que 'titular' existe en el constraint de user_roles
--    (ya fue agregado en la migración anterior, pero aseguramos idempotencia)

-- 2. Crear tabla vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    titular_id      UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    driver_id       UUID             REFERENCES public.usuarios(id) ON DELETE SET NULL,
    marca           TEXT NOT NULL,
    modelo          TEXT NOT NULL,
    año             INTEGER,
    patente         TEXT NOT NULL,
    estado          TEXT CHECK (estado IN ('activo', 'inactivo')) DEFAULT 'activo',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_vehicle_patente UNIQUE (patente)
);

-- 3. Índices para las queries frecuentes
CREATE INDEX IF NOT EXISTS idx_vehicles_titular_id ON public.vehicles (titular_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id  ON public.vehicles (driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_org_id     ON public.vehicles (organizacion_id);

-- 4. Habilitar RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
-- Titular: solo ve sus propios vehículos
CREATE POLICY "vehicles_titular_select" ON public.vehicles
    FOR SELECT
    USING (
        titular_id = auth.uid()
        OR driver_id = auth.uid()
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

-- Solo admin/superadmin crean y modifican vehículos
CREATE POLICY "vehicles_admin_insert" ON public.vehicles
    FOR INSERT
    WITH CHECK (public.get_auth_rol() IN ('admin', 'superadmin'));

CREATE POLICY "vehicles_admin_update" ON public.vehicles
    FOR UPDATE
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));

CREATE POLICY "vehicles_admin_delete" ON public.vehicles
    FOR DELETE
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));
