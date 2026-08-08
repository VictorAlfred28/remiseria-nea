-- =========================================================
-- MIGRACIÓN: MANTENIMIENTOS, TRÁMITES Y BOLSA EXTENDIDA
-- =========================================================

-- 1. Crear el Bucket de Storage para Trámites (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tramites_vehiculares', 'tramites_vehiculares', true)
ON CONFLICT (id) DO NOTHING;

-- Dar permisos públicos al bucket
CREATE POLICY "Public Access tramites" ON storage.objects
    FOR SELECT USING (bucket_id = 'tramites_vehiculares');

CREATE POLICY "Auth Upload tramites" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'tramites_vehiculares' AND auth.role() = 'authenticated');
    
CREATE POLICY "Auth Update tramites" ON storage.objects
    FOR UPDATE USING (bucket_id = 'tramites_vehiculares' AND auth.role() = 'authenticated');

CREATE POLICY "Auth Delete tramites" ON storage.objects
    FOR DELETE USING (bucket_id = 'tramites_vehiculares' AND auth.role() = 'authenticated');


-- 2. Expandir bolsa_empleos
ALTER TABLE public.bolsa_empleos
    ADD COLUMN IF NOT EXISTS experiencia_chofer TEXT,
    ADD COLUMN IF NOT EXISTS turnos_disponibles JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS preferencia_contacto TEXT,
    ADD COLUMN IF NOT EXISTS contacto_valor TEXT,
    ADD COLUMN IF NOT EXISTS tipo_publicacion TEXT DEFAULT 'vehiculo_busca_chofer';

-- 3. Relajar Políticas RLS de bolsa_empleos para que choferes puedan publicar
DROP POLICY IF EXISTS "bolsa_empleos_titular_insert" ON public.bolsa_empleos;
CREATE POLICY "bolsa_empleos_owner_insert" ON public.bolsa_empleos
    FOR INSERT WITH CHECK (
        titular_id = auth.uid() 
        AND (public.has_role_direct(auth.uid(), 'titular') OR public.has_role_direct(auth.uid(), 'chofer') OR public.get_auth_rol() IN ('admin', 'superadmin', 'titular', 'chofer'))
    );

DROP POLICY IF EXISTS "bolsa_empleos_titular_update" ON public.bolsa_empleos;
CREATE POLICY "bolsa_empleos_owner_update" ON public.bolsa_empleos
    FOR UPDATE USING (
        titular_id = auth.uid() 
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

DROP POLICY IF EXISTS "bolsa_empleos_titular_delete" ON public.bolsa_empleos;
CREATE POLICY "bolsa_empleos_owner_delete" ON public.bolsa_empleos
    FOR DELETE USING (
        titular_id = auth.uid() 
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );


-- 4. Crear Tabla Mantenimientos
CREATE TABLE IF NOT EXISTS public.mantenimientos (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    vehiculo_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    tipo_mantenimiento TEXT NOT NULL,
    kilometraje INT,
    fecha DATE NOT NULL,
    descripcion TEXT,
    costo NUMERIC DEFAULT 0,
    estado TEXT CHECK (estado IN ('pendiente', 'completado')) DEFAULT 'completado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_mantenimientos_vehiculo ON public.mantenimientos(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_org ON public.mantenimientos(organizacion_id);

ALTER TABLE public.mantenimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mantenimientos_select" ON public.mantenimientos
    FOR SELECT USING (
        organizacion_id IN (SELECT organizacion_id FROM public.usuarios WHERE id = auth.uid())
        AND (
            EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehiculo_id AND v.titular_id = auth.uid()) OR
            public.get_auth_rol() IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "mantenimientos_insert" ON public.mantenimientos
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehiculo_id AND v.titular_id = auth.uid()) OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "mantenimientos_update" ON public.mantenimientos
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehiculo_id AND v.titular_id = auth.uid()) OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "mantenimientos_delete" ON public.mantenimientos
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehiculo_id AND v.titular_id = auth.uid()) OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );


-- 5. Crear Tabla Tramites
CREATE TABLE IF NOT EXISTS public.tramites (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    vehiculo_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    chofer_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    tipo_tramite TEXT NOT NULL,
    fecha_emision DATE,
    fecha_vencimiento DATE NOT NULL,
    archivo_url TEXT,
    estado TEXT CHECK (estado IN ('vigente', 'vencido', 'en_tramite')) DEFAULT 'vigente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tramites_vehiculo ON public.tramites(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_tramites_chofer ON public.tramites(chofer_id);
CREATE INDEX IF NOT EXISTS idx_tramites_org ON public.tramites(organizacion_id);

ALTER TABLE public.tramites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tramites_select" ON public.tramites
    FOR SELECT USING (
        organizacion_id IN (SELECT organizacion_id FROM public.usuarios WHERE id = auth.uid())
        AND (
            chofer_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehiculo_id AND v.titular_id = auth.uid()) OR
            public.get_auth_rol() IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "tramites_insert" ON public.tramites
    FOR INSERT WITH CHECK (
        chofer_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehiculo_id AND v.titular_id = auth.uid()) OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "tramites_update" ON public.tramites
    FOR UPDATE USING (
        chofer_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehiculo_id AND v.titular_id = auth.uid()) OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "tramites_delete" ON public.tramites
    FOR DELETE USING (
        chofer_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehiculo_id AND v.titular_id = auth.uid()) OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );
