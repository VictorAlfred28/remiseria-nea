-- === MIGRACIÓN: SISTEMA DE PUNTOS Y VIAJES GRATIS ===

-- 1. Agregar campos a la tabla de usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS puntos_actuales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS viajes_gratis INTEGER DEFAULT 0;

-- 2. Agregar campos a la tabla de viajes
ALTER TABLE public.viajes 
ADD COLUMN IF NOT EXISTS puntos_generados INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usado_viaje_gratis BOOLEAN DEFAULT false;

-- 3. Crear tabla historial_puntos
CREATE TABLE IF NOT EXISTS public.historial_puntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    viaje_id UUID REFERENCES public.viajes(id) ON DELETE SET NULL,
    puntos INTEGER NOT NULL,
    tipo TEXT CHECK (tipo IN ('ACUMULACION', 'CANJE')) NOT NULL,
    descripcion TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar RLS para historial_puntos
ALTER TABLE public.historial_puntos ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de seguridad para historial_puntos
DROP POLICY IF EXISTS "historial_puntos_isolation" ON public.historial_puntos;
CREATE POLICY "historial_puntos_isolation" ON public.historial_puntos
    FOR ALL
    USING (user_id = auth.uid() OR public.get_auth_rol() = 'superadmin' OR public.get_auth_rol() = 'admin');

-- 6. Comentarios para documentación
COMMENT ON COLUMN public.usuarios.puntos_actuales IS 'Puntos acumulados por el usuario para canje de viajes gratis.';
COMMENT ON COLUMN public.usuarios.viajes_gratis IS 'Contador de viajes gratuitos disponibles para el usuario.';
COMMENT ON COLUMN public.viajes.puntos_generados IS 'Puntos otorgados al completar este viaje.';
COMMENT ON COLUMN public.viajes.usado_viaje_gratis IS 'Indica si este viaje fue canjeado por puntos (costo $0).';
