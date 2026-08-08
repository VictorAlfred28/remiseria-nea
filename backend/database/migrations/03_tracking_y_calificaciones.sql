-- === 03_TRACKING_Y_CALIFICACIONES.SQL ===

-- 1. Añadir campos de tracking de tiempo a la tabla `viajes`
ALTER TABLE public.viajes
ADD COLUMN IF NOT EXISTS fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS fecha_aceptacion TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fecha_llegada_origen TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fecha_inicio_viaje TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fecha_fin_viaje TIMESTAMP WITH TIME ZONE;

-- 2. Crear tabla `calificaciones`
CREATE TABLE IF NOT EXISTS public.calificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viaje_id UUID NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
    pasajero_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    chofer_id UUID NOT NULL REFERENCES public.choferes(id) ON DELETE CASCADE,
    puntuacion SMALLINT NOT NULL CHECK (puntuacion >= 1 AND puntuacion <= 5),
    comentario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT calificacion_unica_por_viaje UNIQUE (viaje_id)
);

-- 3. Habilitar RLS en `calificaciones`
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para `calificaciones`
-- Los pasajeros pueden crear calificaciones para sus propios viajes y verlas
CREATE POLICY "pasajero_puede_crear_calificacion" 
    ON public.calificaciones FOR INSERT 
    WITH CHECK (pasajero_id = public.get_auth_orga_id() OR pasajero_id IN (SELECT id FROM public.usuarios WHERE id = auth.uid()));

CREATE POLICY "pasajero_puede_ver_sus_calificaciones" 
    ON public.calificaciones FOR SELECT 
    USING (pasajero_id = auth.uid());

-- Los choferes pueden ver las calificaciones que les asignaron
CREATE POLICY "chofer_puede_ver_sus_calificaciones" 
    ON public.calificaciones FOR SELECT 
    USING (chofer_id IN (SELECT id FROM public.choferes WHERE usuario_id = auth.uid()));

-- Los admins / superadmins pueden ver todas (las verán por roles ya dados o simplemente se habilita para superadmin)
CREATE POLICY "superadmin_puede_ver_todas_las_calificaciones" 
    ON public.calificaciones FOR ALL 
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));
