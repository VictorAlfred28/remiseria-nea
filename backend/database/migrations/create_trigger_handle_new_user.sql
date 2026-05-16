-- ==============================================================================
-- TRIGGER PARA AUTOMATIZAR LA CREACIÓN DE PERFIL EN `public.usuarios`
-- ==============================================================================

-- 1. Crear o reemplazar la función que ejecutará el trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nombre TEXT;
  v_rol TEXT;
  v_estado TEXT := 'pendiente';
  v_organizacion_id UUID := 'b99ae208-7467-47d1-b4f9-abe2ed6e66a3'; -- Remiseria NEA Principal
BEGIN
  -- Extraer nombre: busca 'name' o 'nombre' en los metadatos, por defecto 'Usuario'
  v_nombre := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'nombre', 
    'Usuario'
  );

  -- 1. Excepción estricta para SuperAdmin
  IF NEW.email = 'agentech.nea@gmail.com' THEN
    v_rol := 'superadmin';
    v_estado := 'aprobado';
  ELSE
    -- 2. Flujo normal (se actualizará luego por el backend upsert si el frontend envía rol)
    v_rol := COALESCE(
      NEW.raw_user_meta_data->>'rol',
      NEW.raw_user_meta_data->>'role',
      'cliente'
    );
    v_estado := 'pendiente';
  END IF;

  -- Insertar registro. Usamos ON CONFLICT DO NOTHING por si el backend se adelanta (casi imposible pero seguro)
  -- El backend utiliza .upsert() para sobreescribir este rol base con los datos completos del frontend.
  INSERT INTO public.usuarios (
    id,
    organizacion_id,
    email,
    nombre,
    rol,
    estado,
    activo
  ) VALUES (
    NEW.id,
    v_organizacion_id,
    NEW.email,
    v_nombre,
    v_rol,
    v_estado,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 2. Eliminar el trigger si ya existía para evitar duplicados
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Crear el trigger sobre auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
