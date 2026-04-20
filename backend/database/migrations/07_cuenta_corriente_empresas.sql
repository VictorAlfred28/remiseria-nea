-- === VIAJES-NEA: CUENTA CORRIENTE EMPRESARIAL ===
-- Añade rastreo de deuda y saldos para empresas adheridas

-- 1. MODIFICAR TABLA EMPRESAS
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS saldo NUMERIC(10, 2) DEFAULT 0;

-- 2. CREACIÓN DE TABLA DE MOVIMIENTOS
CREATE TABLE IF NOT EXISTS public.cuenta_corriente_empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('DEBITO', 'CREDITO')), -- DEBITO (viajes consumidos), CREDITO (pagos realizados)
    monto NUMERIC(10, 2) NOT NULL,
    descripcion TEXT,
    metodo_pago TEXT,
    referencia_viaje_id UUID REFERENCES public.viajes(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. HABILITACIÓN RLS Y POLÍTICAS
ALTER TABLE public.cuenta_corriente_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_empresas_isolation" ON public.cuenta_corriente_empresas
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE public.empresas.id = public.cuenta_corriente_empresas.empresa_id AND public.empresas.organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );
