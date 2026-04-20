-- Parche de Mejora del Radar de Solicitudes y Tiempo Real
-- Fija estado, aislamiento de asignaciones y ordenamiento por distancia de postGIS para conductores

-- Re-escribimos la Función POSTGIS principal
CREATE OR REPLACE FUNCTION public.get_viajes_cercanos(
    chofer_lat double precision,
    chofer_lng double precision,
    radius_km integer DEFAULT 10,
    target_orga_id uuid DEFAULT NULL::uuid
)
RETURNS SETOF public.viajes
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    mi_orga UUID;
    auth_user_id UUID;
BEGIN
    -- 1. Obtener ID del usuario autenticado (si existe acceso desde Edge o Web)
    auth_user_id := auth.uid();

    -- 2. Determinar Organización Activa
    mi_orga := target_orga_id; 
    
    -- Si no hay orga explícita por parámetro RPC, buscar en el Header Autorizador
    IF mi_orga IS NULL THEN
        mi_orga := (current_setting('request.jwt.claims', true)::jsonb ->> 'organizacion_id')::UUID;
    END IF;

    -- Si sigue siendo NULL y existe session, inferir desde usuario chofer
    IF mi_orga IS NULL AND auth_user_id IS NOT NULL THEN
        SELECT organizacion_id INTO mi_orga FROM public.usuarios WHERE id = auth_user_id;
    END IF;
    
    -- Fallback final: Si la empresa es de inquilino unico (ej. pruebas). 
    IF mi_orga IS NULL THEN
        SELECT id INTO mi_orga FROM public.organizaciones LIMIT 1;
    END IF;

    -- Guardias de Seguridad
    IF mi_orga IS NULL THEN
        RETURN;
    END IF;

    -- Ejecucion y Order Dinámico (Se remueven estados asignado/accepted para evitar viajes fantasmas)
    RETURN QUERY
    SELECT v.* FROM public.viajes v
    WHERE lower(v.estado) IN ('solicitado', 'requested')
      AND v.organizacion_id = mi_orga
      AND v.origen IS NOT NULL
      AND (v.origen->>'lng') IS NOT NULL
      AND (v.origen->>'lat') IS NOT NULL
      AND ST_DistanceSphere(
            ST_MakePoint((v.origen->>'lng')::numeric, (v.origen->>'lat')::numeric),
            ST_MakePoint(chofer_lng, chofer_lat)
          ) <= (radius_km * 1000)
    ORDER BY 
          -- PRIORIDAD AL CHOFER MAS CERCANO
          ST_DistanceSphere(
            ST_MakePoint((v.origen->>'lng')::numeric, (v.origen->>'lat')::numeric),
            ST_MakePoint(chofer_lng, chofer_lat)
          ) ASC, 
          v.creado_en DESC;
END;
$function$;
