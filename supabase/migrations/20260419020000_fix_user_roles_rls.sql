-- R-1: Corrección crítica de seguridad — RLS INSERT en user_roles
-- Detectado en auditoría 2026-04-19.
-- La policy anterior "user_roles_insert" no tenía WITH CHECK,
-- permitiendo a cualquier usuario autenticado autoasignarse roles
-- usando el cliente Supabase directamente (sin pasar por el backend).

-- Eliminar la policy insegura
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;

-- Crear nueva policy segura: solo admin y superadmin pueden insertar roles
CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT
  WITH CHECK (public.get_auth_rol() IN ('admin', 'superadmin'));

-- Eliminar cualquier otra policy de INSERT residual
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND cmd = 'INSERT'
      AND policyname != 'user_roles_admin_insert'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;
