-- =====================================================
-- MIGRACIÓN: Sistema de Control Parental / Teens
-- Ejecutar en: Supabase > SQL Editor
-- =====================================================

-- 1. CREACIÓN DE TABLA: GRUPOS FAMILIARES
CREATE TABLE IF NOT EXISTS public.grupos_familiares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    tutor_user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unq_tutor_orga UNIQUE (tutor_user_id, organizacion_id)
);

-- Habilitar RLS en Grupos Familiares
ALTER TABLE public.grupos_familiares ENABLE ROW LEVEL SECURITY;

-- 2. CREACIÓN DE TABLA: MIEMBROS FAMILIARES
CREATE TABLE IF NOT EXISTS public.miembros_familiares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    grupo_id UUID NOT NULL REFERENCES public.grupos_familiares(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    rol TEXT CHECK (rol IN ('tutor', 'dependiente')) DEFAULT 'dependiente',
    estado TEXT CHECK (estado IN ('pendiente', 'activo', 'bloqueado')) DEFAULT 'pendiente',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unq_miembro_grupo UNIQUE (user_id, grupo_id)
);

-- Habilitar RLS en Miembros Familiares
ALTER TABLE public.miembros_familiares ENABLE ROW LEVEL SECURITY;

-- 3. ACTUALIZACIÓN A LA TABLA VIAJES
-- Para centralizar la delegación del pago y visualización en tiempo real por Supabase
ALTER TABLE public.viajes 
ADD COLUMN IF NOT EXISTS tutor_responsable_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;


-- ======================================================================
-- POLÍTICAS DE AISLAMIENTO Y SEGURIDAD MULTI-TENANT
-- Función get_auth_orga_id() asume que existe en schema actual
-- ======================================================================

-- "Un tutor puede ver su propio grupo familiar" o "Superadmin puede ver todos"
CREATE POLICY "grupos_isolation" ON public.grupos_familiares
    FOR ALL
    USING (
        (organizacion_id = public.get_auth_orga_id() AND tutor_user_id = auth.uid()) 
        OR public.get_auth_rol() = 'superadmin' 
        OR public.get_auth_rol() = 'admin'
    );

-- "Un usuario dependiente puede ver a qué grupo pertenece" / "Un tutor ve a sus miembros"
CREATE POLICY "miembros_isolation" ON public.miembros_familiares
    FOR ALL
    USING (
        (organizacion_id = public.get_auth_orga_id() AND user_id = auth.uid()) -- El dependiente se ve a si mismo o el grupo
        OR 
        (organizacion_id = public.get_auth_orga_id() AND EXISTS (SELECT 1 FROM public.grupos_familiares g WHERE g.id = grupo_id AND g.tutor_user_id = auth.uid()))
        OR public.get_auth_rol() IN ('superadmin', 'admin')
    );

-- Añadimos la capacidad de que un tutor lea los VIAJES que tienen configurado su tutor_responsable_id
-- (Aparte del cliente o chofer que ya lo veían, esto permite al padre rastrear en tiempo real).
-- Supabase acumula las políticas OR. Así que crearemos una exclusiva para tutores.
CREATE POLICY "viajes_tutor_isolation" ON public.viajes
    FOR SELECT
    USING (tutor_responsable_id = auth.uid());

