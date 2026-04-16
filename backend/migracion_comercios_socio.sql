-- =======================================================
-- MIGRACIÓN: CARNET DE SOCIO Y COMERCIOS ADHERIDOS
-- =======================================================

-- 1. Modificar Constraint de Rol para permitir 'comercio'
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin', 'chofer', 'cliente', 'superadmin', 'comercio'));

-- 2. Añadir campo `es_socio` para marcar si el cliente tiene acceso al carnet de fidelización
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS es_socio BOOLEAN DEFAULT true;

-- 3. Crear tabla de registros/historial de escaneos de QR de socios
CREATE TABLE IF NOT EXISTS public.historial_escaneos_socios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comercio_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    beneficio_aplicado TEXT, -- Ejemplo: "15% off", "Café gratis" (Opcional, manual)
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar RLS
ALTER TABLE public.historial_escaneos_socios ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Aislamiento para Escaneos
CREATE POLICY "hist_escaneo_select" ON public.historial_escaneos_socios
    FOR SELECT USING (
        organizacion_id = public.get_current_organizacion_id() OR
        cliente_id = auth.uid() OR
        comercio_id = auth.uid() OR
        public.get_auth_rol() = 'superadmin'
    );

CREATE POLICY "hist_escaneo_insert" ON public.historial_escaneos_socios
    FOR INSERT WITH CHECK (
        comercio_id = auth.uid() OR 
        public.get_auth_rol() IN ('admin', 'superadmin')
    );
