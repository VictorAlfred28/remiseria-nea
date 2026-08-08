-- ==============================================================================
-- UBI INTEGRAL - MIGRACIÓN DEFINITIVA DE ESTADOS DE VIAJE
-- ==============================================================================
-- Esta migración unifica los estados de la base de datos a español:
-- SOLICITADO, ACEPTADO, EN_PUERTA, INICIADO, FINALIZADO, CANCELADO, RECHAZADO, ESPERANDO_TUTOR
-- 
-- El script utiliza un bloque transaccional DO $$. Si alguna condición de
-- concurrencia o diagnóstico falla, Postgres abortará TODO el bloque automáticamente
-- sin dejar la base de datos inconsistente.
-- ==============================================================================

DO $$
DECLARE
    estado_raro TEXT;
    estado_legacy_bloqueado TEXT;
    estado_restante TEXT;
BEGIN
    -- 1. BLOQUEO TEMPORAL PARA CONCURRENCIA
    -- Bloqueamos la tabla en modo EXCLUSIVE para evitar escrituras concurrentes 
    -- durante la migración. Las operaciones que requieran locks incompatibles 
    -- quedarán esperando hasta que finalice la transacción.
    LOCK TABLE viajes IN EXCLUSIVE MODE;

    -- 2. DIAGNÓSTICO PREVENTIVO Y PROTECCIÓN
    -- Verificamos si existe algún viaje con un estado que no está en la lista de estados
    -- históricos conocidos ni en la lista de estados nuevos.
    SELECT estado INTO estado_raro FROM viajes 
    WHERE estado NOT IN (
        -- Estados Legacy a migrar
        'REQUESTED', 'ACCEPTED', 'ASSIGNED', 'ARRIVED', 'STARTED', 
        'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'en_puerta', 
        'solicitado', 'asignado', 'en_camino', 'finalizado', 'cancelado', 
        'esperando_tutor', 'rechazado',
        -- Estados Legacy que abortan la migración
        'QUOTED', 'NO_SHOW',
        -- Estados Nuevos Definitivos
        'SOLICITADO', 'ACEPTADO', 'EN_PUERTA', 'INICIADO', 'FINALIZADO', 
        'CANCELADO', 'RECHAZADO', 'ESPERANDO_TUTOR'
    ) LIMIT 1;
    
    IF FOUND THEN
        RAISE EXCEPTION 'Abortando Migración: Se detectó el estado desconocido "%". Por favor revisa y corrige manualmente.', estado_raro;
    END IF;

    -- 3. VALIDACIÓN DE ESTADOS BLOQUEADOS (QUOTED / NO_SHOW)
    -- Si encontramos algún registro con estos estados, abortamos para revisión manual.
    SELECT estado INTO estado_legacy_bloqueado FROM viajes 
    WHERE estado IN ('QUOTED', 'NO_SHOW') LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Abortando Migración: Se detectaron registros con el estado legacy "%". Se requiere intervención manual.', estado_legacy_bloqueado;
    END IF;

    -- 4. ELIMINACIÓN DEL CONSTRAINT ANTIGUO
    -- Debemos eliminar el constraint antes de actualizar los datos para evitar
    -- que PostgreSQL bloquee la inserción de la nueva nomenclatura en mayúsculas.
    ALTER TABLE viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;

    -- 5. MIGRACIÓN DE ESTADOS
    -- Convertimos todos los estados legacy a la nueva nomenclatura.
    UPDATE viajes SET estado = 'SOLICITADO' WHERE estado IN ('solicitado', 'REQUESTED');
    UPDATE viajes SET estado = 'ACEPTADO' WHERE estado IN ('asignado', 'ACCEPTED', 'en_camino');
    UPDATE viajes SET estado = 'EN_PUERTA' WHERE estado IN ('en_puerta', 'ARRIVED');
    UPDATE viajes SET estado = 'INICIADO' WHERE estado IN ('STARTED', 'IN_PROGRESS');
    UPDATE viajes SET estado = 'FINALIZADO' WHERE estado IN ('finalizado', 'FINISHED');
    UPDATE viajes SET estado = 'CANCELADO' WHERE estado IN ('cancelado', 'CANCELLED');
    UPDATE viajes SET estado = 'RECHAZADO' WHERE estado IN ('rechazado');
    UPDATE viajes SET estado = 'ESPERANDO_TUTOR' WHERE estado IN ('esperando_tutor');

    -- 6. CREACIÓN DEL NUEVO CONSTRAINT
    -- Aplicamos la nueva regla estricta de 8 estados.
    ALTER TABLE viajes ADD CONSTRAINT viajes_estado_check 
    CHECK (estado IN (
        'SOLICITADO', 
        'ACEPTADO', 
        'EN_PUERTA', 
        'INICIADO', 
        'FINALIZADO', 
        'CANCELADO', 
        'RECHAZADO', 
        'ESPERANDO_TUTOR'
    ));

    -- 7. VALIDACIÓN FINAL POST-MIGRACIÓN
    -- Comprobamos que absolutamente ningún registro quedó con un estado ajeno a los 8 definitivos.
    SELECT estado INTO estado_restante FROM viajes 
    WHERE estado NOT IN (
        'SOLICITADO', 
        'ACEPTADO', 
        'EN_PUERTA', 
        'INICIADO', 
        'FINALIZADO', 
        'CANCELADO', 
        'RECHAZADO', 
        'ESPERANDO_TUTOR'
    ) LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Error crítico en la migración: Un registro quedó con el estado "%". Abortando transacción.', estado_restante;
    END IF;

    -- Si llegamos hasta aquí sin excepciones, Postgres realiza el commit de manera automática al cerrar el bloque DO.
    RAISE NOTICE '✅ MIGRACIÓN COMPLETADA CON ÉXITO: Todos los estados han sido unificados y validados de forma segura.';
END $$;

-- 8. ACTUALIZACI�N DEL DEFAULT DE LA COLUMNA
ALTER TABLE viajes ALTER COLUMN estado SET DEFAULT 'SOLICITADO';
