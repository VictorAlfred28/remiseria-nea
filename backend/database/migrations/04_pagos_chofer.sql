-- === 04_PAGOS_CHOFER.SQL ===
-- Sistema de Pagos Manuales (Chofer -> Administración)

-- 1. Tabla Principal
CREATE TABLE IF NOT EXISTS public.pagos_chofer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    chofer_id UUID NOT NULL REFERENCES public.choferes(id) ON DELETE CASCADE,
    monto NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
    estado TEXT CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')) DEFAULT 'PENDIENTE',
    comprobante_url TEXT NOT NULL,
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_validacion TIMESTAMP WITH TIME ZONE,
    admin_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    observaciones TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.pagos_chofer ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS
DROP POLICY IF EXISTS "pagos_chofer_select" ON public.pagos_chofer;
DROP POLICY IF EXISTS "pagos_chofer_insert" ON public.pagos_chofer;
DROP POLICY IF EXISTS "pagos_chofer_update" ON public.pagos_chofer;

-- a) Lectura: Los choferes pueden ver sus propios pagos. Admins/Superadmins ven todos.
-- a) Lectura: Los choferes pueden ver sus propios pagos. Admins/Superadmins ven los de su organización.
CREATE POLICY "pagos_chofer_select" ON public.pagos_chofer
    FOR SELECT
    USING (
        organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin'
    );

-- b) Inserción: Solo los choferes pueden crear pagos (y automáticamente se asocia a su ID)
CREATE POLICY "pagos_chofer_insert" ON public.pagos_chofer
    FOR INSERT
    WITH CHECK (
        organizacion_id = public.get_auth_orga_id()
    );

-- c) Edición: Solo Admins/Superadmins pueden actualizar (Aprobar/Rechazar)
CREATE POLICY "pagos_chofer_update" ON public.pagos_chofer
    FOR UPDATE
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));

-- 4. Supabase Storage: Bucket para Comprobantes
-- Nota: La creación de buckets desde SQL nativo de Supabase a veces requiere configuraciones adicionales de inserción.
-- Se inserta en la tabla de buckets de storage (storage.buckets).
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- Dar permisos para subir archivos de forma pública o autenticada (Opcional, depende de configuración de Storage)
-- CREATE POLICY "Comprobantes Uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprobantes');
-- CREATE POLICY "Comprobantes Public Viewing" ON storage.objects FOR SELECT USING (bucket_id = 'comprobantes');
