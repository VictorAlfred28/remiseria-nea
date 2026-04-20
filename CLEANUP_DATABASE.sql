-- ============================================================
-- SCRIPT DE LIMPIEZA DE BASE DE DATOS (VERSIÓN 2 - MEJORADA)
-- ============================================================
-- Elimina TODOS los datos de la base de datos
-- EXCEPTO: Admin (victoralfredo2498@gmail.com) y su organizacion
--
-- ⚠️ ADVERTENCIA: Este script es DESTRUCTIVO
-- Ejecutar SOLO en Supabase SQL Editor
-- ============================================================

-- 1. VALIDAR ADMIN Y TRANSACCIÓN
BEGIN;

DO $$
DECLARE
    user_count INT;
BEGIN
    -- Validar que el admin existe (si no, rollback automático)
    SELECT COUNT(*) INTO user_count 
    FROM public.usuarios 
    WHERE email = 'victoralfredo2498@gmail.com';
    
    IF user_count = 0 THEN
        ROLLBACK;
        RAISE EXCEPTION 'FATAL: Admin victoralfredo2498@gmail.com NO ENCONTRADO. Base de datos NO modificada.';
    END IF;
    
    RAISE NOTICE '✓ Validación exitosa: Admin existe';
    RAISE NOTICE '✓ Iniciando limpieza completa...';
END $$;

-- ============================================================
-- 2. ELIMINAR DATOS EN ORDEN CORRECTO (FK Dependencies)
-- ============================================================

-- TIER 1: Sin Foreign Keys
DELETE FROM public.chat_sessions;
DELETE FROM public.conversation_state;

-- TIER 2: Auditoria y seguridad
DELETE FROM public.movimientos_saldo;
DELETE FROM public.historial_puntos;
DELETE FROM public.payment_audit_log;
DELETE FROM public.security_audit_log;
DELETE FROM public.token_blacklist;
DELETE FROM public.rate_limit_state;

-- TIER 3: Booking (calificaciones -> viajes)
DELETE FROM public.calificaciones;
DELETE FROM public.pagos_chofer;

-- TIER 4: Viajes (depende de choferes y clientes)
DELETE FROM public.viajes;

-- TIER 5: Familias (grupos y zonas)
DELETE FROM public.miembros_familiares;
DELETE FROM public.family_zones;
DELETE FROM public.family_rules;
DELETE FROM public.grupos_familiares;

-- TIER 6: Empresas y socios
DELETE FROM public.cuenta_corriente_empresas;
DELETE FROM public.historial_escaneos_socios;
DELETE FROM public.empresa_beneficios;
DELETE FROM public.empresa_usuarios;
DELETE FROM public.empresas;

-- TIER 7: Tarifas y reservas
DELETE FROM public.tariff_history;
DELETE FROM public.tariff_branding;
DELETE FROM public.tariff_configs;
DELETE FROM public.reservations;

-- TIER 8: Comercios y promociones
DELETE FROM public.comercios;
DELETE FROM public.comercio_solicitudes;
DELETE FROM public.promociones;

-- TIER 9: Choferes y destinos
DELETE FROM public.choferes;
DELETE FROM public.fixed_destinations;

-- TIER 10: Usuarios (PRESERVAR ADMIN)
DELETE FROM public.usuarios 
WHERE email != 'victoralfredo2498@gmail.com';

-- TIER 11: User roles
DELETE FROM public.user_roles;

-- TIER 12: Tablas opcionales de pagos (con manejo de errores)
DO $$
BEGIN
    EXECUTE 'DELETE FROM public.payments_processed';
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠ Tabla payments_processed no existe (opcional)';
END $$;

DO $$
BEGIN
    EXECUTE 'DELETE FROM public.mercadopago_preferences';
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠ Tabla mercadopago_preferences no existe (opcional)';
END $$;

-- ============================================================
-- 3. VERIFICACIÓN Y RESUMEN FINAL
-- ============================================================
DO $$
DECLARE
    total_usuarios INT;
    admin_email TEXT;
    org_name TEXT;
BEGIN
    -- Contar usuarios restantes
    SELECT COUNT(*) INTO total_usuarios FROM public.usuarios;
    
    -- Obtener email del admin restante
    SELECT email INTO admin_email FROM public.usuarios LIMIT 1;
    
    -- Obtener nombre de la organización
    SELECT nombre INTO org_name
    FROM public.organizaciones 
    WHERE id = (
        SELECT organizacion_id FROM public.usuarios 
        WHERE email = 'victoralfredo2498@gmail.com'
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✓ LIMPIEZA COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Usuarios restantes: %', total_usuarios;
    RAISE NOTICE 'Admin: %', admin_email;
    RAISE NOTICE 'Organización: %', org_name;
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'BD lista para desarrollo. Todos los datos no-admin eliminados.';
END $$;

-- 4. FINALIZAR TRANSACCIÓN
COMMIT;
