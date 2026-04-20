-- ==========================================
-- MIGRACIÓN: SISTEMA MULTI-ROL (user_roles)
-- Extiende el sistema sin romper usuarios.rol
-- ==========================================

-- 1. Crear tabla user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN (
                        'admin', 'chofer', 'cliente', 'superadmin', 'comercio', 'titular'
                    )),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role)
);

-- 2. Migrar roles existentes desde usuarios.rol → user_roles
--    ON CONFLICT silencia duplicados si se re-ejecuta la migración
INSERT INTO public.user_roles (user_id, role, organizacion_id)
SELECT id, rol, organizacion_id
FROM   public.usuarios
WHERE  rol IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Índices para las queries frecuentes del backend
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role    ON public.user_roles (role);

-- 4. Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
-- Lectura: el propio usuario ve sus roles; admin/superadmin ven los de su organización
CREATE POLICY "user_roles_select" ON public.user_roles
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

-- Inserción/actualización: solo admin y superadmin asignan roles
CREATE POLICY "user_roles_insert" ON public.user_roles
    FOR INSERT
    WITH CHECK (public.get_auth_rol() IN ('admin', 'superadmin'));

CREATE POLICY "user_roles_delete" ON public.user_roles
    FOR DELETE
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));
