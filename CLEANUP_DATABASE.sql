-- ============================================================
-- SCRIPT DE LIMPIEZA DE BASE DE DATOS
-- ============================================================
-- Elimina TODOS los datos de la base de datos
-- EXCEPTO: Admin (victoralfredo2498@gmail.com) y su organizacion
--
-- ⚠️ ADVERTENCIA: Este script es DESTRUCTIVO
-- Ejecutar en Supabase SQL Editor solamente
-- ============================================================

-- 1. GUARDAR ID DEL ADMIN Y SU ORGANIZACIÓN
DO $$
DECLARE
    admin_id UUID;
    org_id UUID;
BEGIN
    -- Encontrar el admin por email
    SELECT id, organizacion_id INTO admin_id, org_id
    FROM public.usuarios
    WHERE email = 'victoralfredo2498@gmail.com'
    LIMIT 1;

    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin con email victoralfredo2498@gmail.com no encontrado';
    END IF;

    -- Guardar en variables de sesión para usarlas después
    PERFORM set_config('app.admin_id', admin_id::TEXT, TRUE);
    PERFORM set_config('app.org_id', org_id::TEXT, TRUE);
    
    RAISE NOTICE 'Admin ID: %, Org ID: %', admin_id, org_id;
END $$;

-- ============================================================
-- 2. ELIMINAR DATOS EN ORDEN (respetando Foreign Keys)
-- ============================================================
-- Orden: Tablas dependientes primero → Tablas independientes al final

-- Limpiar tabla: chat_sessions
DELETE FROM public.chat_sessions 
WHERE EXISTS (
    SELECT 1 FROM public.usuarios u 
    WHERE u.id = public.chat_sessions.user_id 
      AND u.email != 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: movimientos_saldo
DELETE FROM public.movimientos_saldo
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: conversation_state
DELETE FROM public.conversation_state;

-- Limpiar tabla: historial_puntos
DELETE FROM public.historial_puntos
WHERE user_id IN (
    SELECT id FROM public.usuarios 
    WHERE email != 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: calificaciones
DELETE FROM public.calificaciones
WHERE viaje_id IN (
    SELECT id FROM public.viajes
    WHERE organizacion_id NOT IN (
        SELECT organizacion_id FROM public.usuarios 
        WHERE email = 'victoralfredo2498@gmail.com'
    )
);

-- Limpiar tabla: pagos_chofer
DELETE FROM public.pagos_chofer
WHERE chofer_id IN (
    SELECT id FROM public.choferes
    WHERE organizacion_id NOT IN (
        SELECT organizacion_id FROM public.usuarios 
        WHERE email = 'victoralfredo2498@gmail.com'
    )
);

-- Limpiar tabla: viajes (depende de choferes y clientes)
DELETE FROM public.viajes
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: miembros_familiares
DELETE FROM public.miembros_familiares
WHERE grupo_id IN (
    SELECT id FROM public.grupos_familiares
    WHERE usuario_id IN (
        SELECT id FROM public.usuarios 
        WHERE email != 'victoralfredo2498@gmail.com'
    )
);

-- Limpiar tabla: grupos_familiares
DELETE FROM public.grupos_familiares
WHERE usuario_id IN (
    SELECT id FROM public.usuarios 
    WHERE email != 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: family_zones
DELETE FROM public.family_zones
WHERE family_rule_id IN (
    SELECT id FROM public.family_rules
    WHERE user_id IN (
        SELECT id FROM public.usuarios 
        WHERE email != 'victoralfredo2498@gmail.com'
    )
);

-- Limpiar tabla: family_rules
DELETE FROM public.family_rules
WHERE user_id IN (
    SELECT id FROM public.usuarios 
    WHERE email != 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: cuenta_corriente_empresas
DELETE FROM public.cuenta_corriente_empresas
WHERE empresa_id IN (
    SELECT id FROM public.empresas
    WHERE organizacion_id NOT IN (
        SELECT organizacion_id FROM public.usuarios 
        WHERE email = 'victoralfredo2498@gmail.com'
    )
);

-- Limpiar tabla: historial_escaneos_socios
DELETE FROM public.historial_escaneos_socios
WHERE usuario_id IN (
    SELECT id FROM public.usuarios 
    WHERE email != 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: empresa_beneficios
DELETE FROM public.empresa_beneficios
WHERE empresa_id IN (
    SELECT id FROM public.empresas
    WHERE organizacion_id NOT IN (
        SELECT organizacion_id FROM public.usuarios 
        WHERE email = 'victoralfredo2498@gmail.com'
    )
);

-- Limpiar tabla: empresa_usuarios
DELETE FROM public.empresa_usuarios
WHERE empresa_id IN (
    SELECT id FROM public.empresas
    WHERE organizacion_id NOT IN (
        SELECT organizacion_id FROM public.usuarios 
        WHERE email = 'victoralfredo2498@gmail.com'
    )
);

-- Limpiar tabla: empresas
DELETE FROM public.empresas
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: tariff_history
DELETE FROM public.tariff_history
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: tariff_branding
DELETE FROM public.tariff_branding
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: tariff_configs
DELETE FROM public.tariff_configs
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: reservations
DELETE FROM public.reservations
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: comercios (depende de usuarios)
DELETE FROM public.comercios
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
) OR user_id IN (
    SELECT id FROM public.usuarios 
    WHERE email != 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: comercio_solicitudes
DELETE FROM public.comercio_solicitudes
WHERE user_id IN (
    SELECT id FROM public.usuarios 
    WHERE email != 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: promociones
DELETE FROM public.promociones
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: choferes
DELETE FROM public.choferes
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: fixed_destinations
DELETE FROM public.fixed_destinations
WHERE organizacion_id NOT IN (
    SELECT organizacion_id FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: usuarios (MANTENER SOLO AL ADMIN)
DELETE FROM public.usuarios
WHERE email != 'victoralfredo2498@gmail.com';

-- Limpiar tabla: user_roles (si existe) - MANTENER ROL DEL ADMIN
DELETE FROM public.user_roles
WHERE user_id IN (
    SELECT id FROM public.usuarios 
    WHERE email != 'victoralfredo2498@gmail.com'
);

-- Limpiar tabla: payments_processed (si existe) - Tabla de seguridad
DELETE FROM public.payments_processed;

-- Limpiar tabla: mercadopago_preferences (si existe) - Tabla de pagos
DELETE FROM public.mercadopago_preferences;

-- Limpiar tabla: payment_audit_log (si existe) - Tabla de auditoría
DELETE FROM public.payment_audit_log;

-- Limpiar tabla: security_audit_log (si existe) - Tabla de auditoría
DELETE FROM public.security_audit_log;

-- Limpiar tabla: token_blacklist (si existe) - Tabla de seguridad
DELETE FROM public.token_blacklist;

-- Limpiar tabla: rate_limit_state (si existe) - Tabla de rate limiting
DELETE FROM public.rate_limit_state;

-- ============================================================
-- 3. RESUMEN FINAL
-- ============================================================
DO $$
DECLARE
    total_usuarios INT;
    org_name TEXT;
BEGIN
    -- Contar usuarios restantes
    SELECT COUNT(*) INTO total_usuarios FROM public.usuarios;
    
    -- Obtener nombre de la organización
    SELECT nombre INTO org_name
    FROM public.organizaciones 
    WHERE id = (
        SELECT organizacion_id FROM public.usuarios 
        WHERE email = 'vicoralfredo2498@gmail.com'
    );
    
    RAISE NOTICE '================================================';
    RAISE NOTICE 'LIMPIEZA DE BASE DE DATOS COMPLETADA';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Usuarios restantes: %', total_usuarios;
    RAISE NOTICE 'Organización: %', org_name;
    RAISE NOTICE 'Admin: victoralfredo2498@gmail.com';
    RAISE NOTICE '================================================';
END $$;
