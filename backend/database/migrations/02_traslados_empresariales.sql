-- === VIAJES-NEA: TRASLADOS EMPRESARIALES ===
-- Añadiendo funcionalidades para viajes corporativos sin agregar "Rol Empresa"

-- 1. CREACIÓN DE TABLAS

CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre_empresa TEXT NOT NULL,
    cuit TEXT,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.empresa_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    limite_mensual NUMERIC(10, 2) DEFAULT 0, -- 0 = Sin limite
    saldo NUMERIC(10, 2) DEFAULT 0,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- Un usuario pertenece a UNA empresa
);

CREATE TABLE IF NOT EXISTS public.empresa_beneficios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo_descuento TEXT CHECK (tipo_descuento IN ('PORCENTAJE', 'FIJO')) DEFAULT 'PORCENTAJE',
    valor NUMERIC(10, 2) NOT NULL,
    limite_mensual INTEGER DEFAULT 0, -- Viajes mensuales max permitidos, 0 = infinito
    horario_inicio TIME,
    horario_fin TIME,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ALTERACIÓN DE TABLA VIAJES
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS tipo_viaje TEXT DEFAULT 'PERSONAL';
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
-- "precio_original", "monto_descontado" y "final_price" ("precio") ya existen y los reutilizaremos para no duplicar datos, 
-- aplicando monto_descontado si aplica beneficio de empresa

-- 3. HABILITACIÓN RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_beneficios ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS (Multi-Tenant isolation)
-- Solo visible para la misma organizacion
CREATE POLICY "empresas_isolation" ON public.empresas
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- empresa_usuarios, heredando la organizacion de empresas
CREATE POLICY "empresa_usuarios_isolation" ON public.empresa_usuarios
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE public.empresas.id = public.empresa_usuarios.empresa_id AND public.empresas.organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );

-- empresa_beneficios
CREATE POLICY "empresa_beneficios_isolation" ON public.empresa_beneficios
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE public.empresas.id = public.empresa_beneficios.empresa_id AND public.empresas.organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );
