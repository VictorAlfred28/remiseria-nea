-- =========================================================================
-- Auditoría de Seguridad Viajes NEA - Parche SQL 
-- 1. Bloqueo de escalamiento de privilegios por frontend
-- =========================================================================

-- Trigger para bloquear el cambio de columnas sensibles desde el cliente web
CREATE OR REPLACE FUNCTION public.trg_proteger_columnas_usuarios()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la consulta NO proviene de PostgREST sino del backend backend, la saltamos.
    -- Pero PostgREST usa un rol llamado 'anon' o 'authenticated'
    IF current_user IN ('anon', 'authenticated') THEN
        -- Solo dejamos pasar si el JWT rol es 'superadmin' explicitamente (si asi lo codificaste en el payload)
        IF NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'rol', '') IS DISTINCT FROM 'superadmin' THEN
            
            -- Detectar intento de auto-asignacion de rol
            IF NEW.rol IS DISTINCT FROM OLD.rol THEN
                RAISE EXCEPTION 'ALERTA DE SEGURIDAD: Inyección detectada al intentar alterar rol';
            END IF;
            
            -- Detectar alteracion de puntos
            IF NEW.puntos_actuales IS DISTINCT FROM OLD.puntos_actuales THEN
                RAISE EXCEPTION 'ALERTA DE SEGURIDAD: Inyección detectada al alterar puntos actuales';
            END IF;

            -- Detectar fraude en viajes gratis
            IF NEW.viajes_gratis IS DISTINCT FROM OLD.viajes_gratis THEN
                RAISE EXCEPTION 'ALERTA DE SEGURIDAD: Inyección detectada al alterar viajes_gratis';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminamos si existia antes para no duplicar
DROP TRIGGER IF EXISTS trg_proteger_columnas_usuarios_trigger ON public.usuarios;

-- Creamos el trigger sobre public.usuarios ANTES DEL UPDATE
CREATE TRIGGER trg_proteger_columnas_usuarios_trigger
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.trg_proteger_columnas_usuarios();
