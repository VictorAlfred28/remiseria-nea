-- ==========================================
-- CREATE COMMERCE TABLES
-- ==========================================

-- 1. Table for adhession requests
CREATE TABLE IF NOT EXISTS public.comercio_solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rubro TEXT NOT NULL,
    direccion TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    descripcion TEXT,
    logo_url TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Table for approved businesses
CREATE TABLE IF NOT EXISTS public.comercios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre_comercio TEXT NOT NULL,
    rubro TEXT NOT NULL,
    direccion TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    descripcion TEXT,
    logo_url TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    estado TEXT DEFAULT 'ACTIVO',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 3. Extend Promociones table mapping to Commerce
ALTER TABLE public.promociones ADD COLUMN IF NOT EXISTS comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;

-- 4. Alter user_id on Promociones to allow a user to manage it (Not strictly needed if we just link by comercio_id, but good for RLS)
-- We will rely on rls matching comercio_id -> user_id

-- ==========================================
-- ENABLE ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.comercio_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios ENABLE ROW LEVEL SECURITY;

-- Disable RLS temporarily or adjust for initial data migrations if necessary
-- For now, let's create the permissive default policies for the organizational boundaries:

-- POLICIES FOR comercio_solicitudes
CREATE POLICY "solicitudes_select" ON public.comercio_solicitudes
    FOR SELECT USING (
        user_id = auth.uid() OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "solicitudes_insert" ON public.comercio_solicitudes
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "solicitudes_update" ON public.comercio_solicitudes
    FOR UPDATE USING (
        user_id = auth.uid() OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

-- POLICIES FOR comercios
CREATE POLICY "comercios_select" ON public.comercios
    FOR SELECT USING (
        organizacion_id = public.get_current_organizacion_id() OR
        public.get_auth_rol() = 'superadmin'
    );

CREATE POLICY "comercios_insert" ON public.comercios
    FOR INSERT WITH CHECK (
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "comercios_update" ON public.comercios
    FOR UPDATE USING (
        user_id = auth.uid() OR
        public.get_auth_rol() IN ('admin', 'superadmin')
    );
