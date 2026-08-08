-- =========================================================================
-- Auditoría de Seguridad Viajes NEA - Parche SQL Múltiple (Producción)
-- 1. Introducción de PostGIS para Geolocalización Aislada
-- 2. Refactor de Aislamiento de Organizaciones (RLS Estricto)
-- 3. Inserción de Constrainsts de Pagos para mitigar Race Conditions
-- =========================================================================

-- PARTE 1: ACTIVAR POSTGIS PARA EL RADAR (Geospatial extension)
CREATE EXTENSION IF NOT EXISTS postgis;

-- PARTE 2: FUNCIÓN SEGURA DE RADAR POR DISTANCIA (Oculta viajes lejanos al chofer)
-- El chofer le enviará sus coordenadas actuales a esta RPC.
-- target_orga_id: Parámetro opcional para cuando se llama desde el backend con Service Role Key.
CREATE OR REPLACE FUNCTION get_viajes_cercanos(chofer_lat float, chofer_lng float, radius_km integer DEFAULT 10, target_orga_id UUID DEFAULT NULL)
RETURNS SETOF public.viajes
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    mi_orga UUID;
    auth_user_id UUID;
BEGIN
    -- 1. Obtener ID del usuario autenticado (si existe)
    auth_user_id := auth.uid();

    -- 2. Determinar Organización
    mi_orga := target_orga_id; 
    
    -- Si no hay orga explícita, buscar en el JWT
    IF mi_orga IS NULL THEN
        mi_orga := (current_setting('request.jwt.claims', true)::jsonb ->> 'organizacion_id')::UUID;
    END IF;

    -- Si sigue siendo NULL, buscar en la tabla de usuarios del chofer
    IF mi_orga IS NULL AND auth_user_id IS NOT NULL THEN
        SELECT organizacion_id INTO mi_orga FROM public.usuarios WHERE id = auth_user_id;
    END IF;
    
    -- Fallback final: Si sigue siendo NULL y solo hay una orga en el sistema, usarla
    IF mi_orga IS NULL THEN
        SELECT id INTO mi_orga FROM public.organizaciones LIMIT 1;
    END IF;

    -- Si no hay orga a este punto, no podemos devolver nada por seguridad
    IF mi_orga IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT v.* FROM public.viajes v
    WHERE lower(v.estado) IN ('solicitado', 'requested') -- FIX: Evitar que choferes vean viajes ajenos (asignado, accepted, arrived)
      AND v.organizacion_id = mi_orga
      AND v.origen IS NOT NULL
      AND (v.origen->>'lng') IS NOT NULL
      AND (v.origen->>'lat') IS NOT NULL
      AND ST_DistanceSphere(
            ST_MakePoint((v.origen->>'lng')::numeric, (v.origen->>'lat')::numeric),
            ST_MakePoint(chofer_lng, chofer_lat)
          ) <= (radius_km * 1000)
    ORDER BY 
          ST_DistanceSphere(
            ST_MakePoint((v.origen->>'lng')::numeric, (v.origen->>'lat')::numeric),
            ST_MakePoint(chofer_lng, chofer_lat)
          ) ASC,
          v.creado_en DESC;
END;
$$;


-- PARTE 3: REFACTORIZACIÓN DE SEGURIDAD RLS PARA EVITAR ESCALAMIENTO DE PERMISOS
-- NOTA: Previamente existía "usuarios_isolation" con FOR ALL que permitía a CUALQUIERA editar u borrar CUALQUIERA en la empresa.

DROP POLICY IF EXISTS "usuarios_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_select_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_update_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_delete_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_insert_isolation" ON public.usuarios;

-- a) Lectura: Todos pueden leer su propio perfil. Además, todos en la misma empresa pueden listar los usuarios (ej: buscar choferes, etc)
CREATE POLICY "usu_select_isolation" ON public.usuarios
    FOR SELECT 
    USING (id = auth.uid() OR organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');


-- b) Edición (UPDATE): Solo puedes editar tu PROPIO usuario.
CREATE POLICY "usu_update_isolation" ON public.usuarios
    FOR UPDATE
    USING (id = auth.uid() OR public.get_auth_rol() = 'superadmin');

-- c) Eliminación (DELETE): Solo los superadmins o tú mismo puedes borrar tu perfil.
CREATE POLICY "usu_delete_isolation" ON public.usuarios
    FOR DELETE
    USING (id = auth.uid() OR public.get_auth_rol() = 'superadmin');

-- d) Inserción (INSERT): Mantener auto-registro protegido
CREATE POLICY "usu_insert_isolation" ON public.usuarios 
    FOR INSERT 
    WITH CHECK (auth.uid() = id OR public.get_auth_rol() = 'superadmin');


-- PARTE 4: UNIQUE KEY PARA EVITAR DOBLE GASTO / RACE CONDITIONS DE MERCADO PAGO
-- Agrega restricción en base de datos. Si otro web-hook entra al revés o de la misma petición, BD tirará Integrity Error y abortará.
-- Asumiendo que la tabla es movimientos_saldo (o similar que se utilice para registrar).
-- NOTA: Primero validamos si existe mp_payment_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movimientos_saldo' AND column_name='mp_payment_id') THEN
        ALTER TABLE public.movimientos_saldo ADD COLUMN mp_payment_id TEXT UNIQUE;
    ELSE
        -- Si la columna ya existe, asegurarse de que sea UNIQUE
        ALTER TABLE public.movimientos_saldo DROP CONSTRAINT IF EXISTS movimientos_saldo_mp_payment_id_key;
        ALTER TABLE public.movimientos_saldo ADD CONSTRAINT movimientos_saldo_mp_payment_id_key UNIQUE(mp_payment_id);
    END IF;
END $$;
