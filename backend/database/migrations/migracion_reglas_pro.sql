-- =====================================================
-- MIGRACIÓN: Reglas Avanzadas de Control Parental (PRO)
-- Ejecutar en: Supabase > SQL Editor
-- =====================================================

-- 1. EXTENDER LA TABLA DE VIAJES PARA ESTADOS MANUALES
-- Actualizar la constraint del estado para aceptar "esperando_tutor"
ALTER TABLE public.viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;

ALTER TABLE public.viajes ADD CONSTRAINT viajes_estado_check 
CHECK (estado IN ('solicitado', 'asignado', 'en_camino', 'finalizado', 'cancelado', 'esperando_tutor', 'rechazado'));

-- 2. TABLA DE REGLAS
CREATE TABLE IF NOT EXISTS public.family_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID NOT NULL REFERENCES public.grupos_familiares(id) ON DELETE CASCADE,
    max_trips_per_day INTEGER DEFAULT NULL,
    max_amount_per_trip NUMERIC(10, 2) DEFAULT NULL,
    allowed_start_time TIME DEFAULT NULL,
    allowed_end_time TIME DEFAULT NULL,
    require_approval BOOLEAN DEFAULT false,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unq_regla_grupo UNIQUE (grupo_id)
);

-- 3. TABLA DE GEOFENCING (ZONAS)
CREATE TABLE IF NOT EXISTS public.family_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID NOT NULL REFERENCES public.grupos_familiares(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('permitida', 'restringida')) DEFAULT 'permitida',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radio_metros INTEGER NOT NULL DEFAULT 1000,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- HABILITACIÓN RLS Y POLÍTICAS
-- =====================================================

ALTER TABLE public.family_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_zones ENABLE ROW LEVEL SECURITY;

-- Un tutor o miembro del grupo puede leer las reglas
CREATE POLICY "fr_select" ON public.family_rules FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = family_rules.grupo_id AND tutor_user_id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM public.miembros_familiares WHERE grupo_id = family_rules.grupo_id AND user_id = auth.uid())
);

-- SOLO el tutor dueño del grupo puede insertar/editar reglas
CREATE POLICY "fr_all" ON public.family_rules
FOR ALL 
USING (
    EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = family_rules.grupo_id AND tutor_user_id = auth.uid())
);

-- Mismas políticas para las Zonas
CREATE POLICY "fz_select" ON public.family_zones FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = family_zones.grupo_id AND tutor_user_id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM public.miembros_familiares WHERE grupo_id = family_zones.grupo_id AND user_id = auth.uid())
);

CREATE POLICY "fz_all" ON public.family_zones
FOR ALL 
USING (
    EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = family_zones.grupo_id AND tutor_user_id = auth.uid())
);
