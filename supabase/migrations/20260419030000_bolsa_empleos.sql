-- =========================================================
-- MIGRACIÓN: BOLSA DE EMPLEOS (VACANTES Y POSTULACIONES)
-- =========================================================

-- 1. Tabla de Ofertas de Empleo (Vacantes)
CREATE TABLE IF NOT EXISTS public.bolsa_empleos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    titular_id      UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    vehicle_id      UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    titulo          TEXT NOT NULL,
    descripcion     TEXT,
    requisitos      TEXT,
    estado          TEXT CHECK (estado IN ('abierta', 'en_proceso', 'cerrada')) DEFAULT 'abierta',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Postulaciones de Choferes
CREATE TABLE IF NOT EXISTS public.bolsa_postulaciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    oferta_id       UUID NOT NULL REFERENCES public.bolsa_empleos(id) ON DELETE CASCADE,
    chofer_id       UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    mensaje         TEXT,
    estado          TEXT CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')) DEFAULT 'pendiente',
    aprobado_por    UUID REFERENCES public.usuarios(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_postulacion UNIQUE (oferta_id, chofer_id)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_bolsa_empleos_titular ON public.bolsa_empleos(titular_id);
CREATE INDEX IF NOT EXISTS idx_bolsa_empleos_org ON public.bolsa_empleos(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_bolsa_postulaciones_oferta ON public.bolsa_postulaciones(oferta_id);
CREATE INDEX IF NOT EXISTS idx_bolsa_postulaciones_chofer ON public.bolsa_postulaciones(chofer_id);

-- 4. Habilitar RLS
ALTER TABLE public.bolsa_empleos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolsa_postulaciones ENABLE ROW LEVEL SECURITY;

-- 5. Políticas para bolsa_empleos
CREATE POLICY "bolsa_empleos_select_all" ON public.bolsa_empleos
    FOR SELECT USING (
        estado = 'abierta' 
        OR titular_id = auth.uid()
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "bolsa_empleos_titular_insert" ON public.bolsa_empleos
    FOR INSERT WITH CHECK (
        titular_id = auth.uid() 
        AND (public.has_role_direct(auth.uid(), 'titular') OR public.get_auth_rol() IN ('admin', 'superadmin', 'titular'))
    );

CREATE POLICY "bolsa_empleos_titular_update" ON public.bolsa_empleos
    FOR UPDATE USING (
        titular_id = auth.uid() 
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "bolsa_empleos_titular_delete" ON public.bolsa_empleos
    FOR DELETE USING (
        titular_id = auth.uid() 
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

-- 6. Políticas para bolsa_postulaciones
CREATE POLICY "bolsa_postulaciones_select" ON public.bolsa_postulaciones
    FOR SELECT USING (
        chofer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.bolsa_empleos WHERE id = oferta_id AND titular_id = auth.uid())
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "bolsa_postulaciones_chofer_insert" ON public.bolsa_postulaciones
    FOR INSERT WITH CHECK (
        chofer_id = auth.uid()
        AND (public.has_role_direct(auth.uid(), 'chofer') OR public.get_auth_rol() IN ('admin', 'superadmin', 'chofer'))
    );

CREATE POLICY "bolsa_postulaciones_admin_update" ON public.bolsa_postulaciones
    FOR UPDATE USING (
        public.get_auth_rol() IN ('admin', 'superadmin')
    );
