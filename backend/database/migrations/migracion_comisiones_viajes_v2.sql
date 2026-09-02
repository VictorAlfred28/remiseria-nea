-- ==============================================================================
-- MIGRACIÓN: RECAUDACIONES DEL CHOFER V2
-- ==============================================================================

-- 1. Añadir columna 'comision_aplicada' (NUMERIC, DEFAULT NULL) para preservar el estado histórico
ALTER TABLE viajes
ADD COLUMN IF NOT EXISTS comision_aplicada NUMERIC(10, 2) DEFAULT NULL;

-- 2. Índice compuesto para acelerar las búsquedas de la nueva sección de ganancias
CREATE INDEX IF NOT EXISTS idx_viajes_chofer_estado_fecha ON viajes (chofer_id, estado, creado_en);

-- 3. Sobrescribir la RPC principal de finalización
-- Se preserva la lógica de facturación de empresas, puntos y descuento de saldo intacta.
-- Única adición: comision_aplicada = p_comision_deduccion en el UPDATE de viajes.
CREATE OR REPLACE FUNCTION finalizar_viaje_transaccional(
  p_viaje_id UUID,
  p_final_price NUMERIC,
  p_wait_minutes INT,
  p_wait_cost NUMERIC,
  p_puntos_ganados INT,
  p_cliente_id UUID,
  p_empresa_id UUID,
  p_chofer_id UUID,
  p_comision_deduccion NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_total_puntos INT;
    v_nuevos_viajes_gratis INT;
    v_tiene_viaje_gratis BOOLEAN := FALSE;
    v_resultado JSONB;
BEGIN
    -- 1. Actualizar Viaje Principal (Dando por finalizado)
    UPDATE viajes
    SET estado = 'FINALIZADO',
        finished_at = NOW(),
        fecha_fin_viaje = NOW(),
        wait_minutes = p_wait_minutes,
        wait_cost = p_wait_cost,
        final_price = p_final_price,
        precio = p_final_price,
        puntos_generados = p_puntos_ganados,
        comision_aplicada = p_comision_deduccion
    WHERE id = p_viaje_id;

    -- 2. Sistema de Cuasi-Facturación para Empresas Cuenta Corriente
    IF p_empresa_id IS NOT NULL THEN
        UPDATE empresas
        SET saldo = COALESCE(saldo, 0) + p_final_price
        WHERE id = p_empresa_id;

        INSERT INTO cuenta_corriente_empresas (empresa_id, tipo, monto, descripcion, referencia_viaje_id)
        VALUES (p_empresa_id, 'DEBITO', p_final_price, 'Viaje (Ref: ' || left(p_viaje_id::text, 8) || ')', p_viaje_id::text);
    END IF;

    -- 3. Cobro de Comisión Billetera del Chofer (Si opera por comisión)
    IF p_chofer_id IS NOT NULL AND p_comision_deduccion > 0 THEN
        UPDATE choferes
        SET saldo = COALESCE(saldo, 0) - p_comision_deduccion
        WHERE id = p_chofer_id;
    END IF;

    -- 4. Sistema de Lealtad y Recompensas (Pasajeros)
    v_total_puntos := 0;
    IF p_cliente_id IS NOT NULL AND p_puntos_ganados > 0 THEN
        v_total_puntos := (SELECT puntos_actuales FROM usuarios WHERE id = p_cliente_id);
        v_nuevos_viajes_gratis := (SELECT viajes_gratis FROM usuarios WHERE id = p_cliente_id);

        v_total_puntos := COALESCE(v_total_puntos, 0) + p_puntos_ganados;
        v_nuevos_viajes_gratis := COALESCE(v_nuevos_viajes_gratis, 0);

        IF v_total_puntos >= 100 THEN
            v_total_puntos := v_total_puntos - 100;
            v_nuevos_viajes_gratis := v_nuevos_viajes_gratis + 1;
            v_tiene_viaje_gratis := TRUE;
        END IF;

        UPDATE usuarios
        SET puntos_actuales = v_total_puntos,
            viajes_gratis = v_nuevos_viajes_gratis
        WHERE id = p_cliente_id;

        INSERT INTO historial_puntos (user_id, viaje_id, puntos, tipo, descripcion)
        VALUES (p_cliente_id, p_viaje_id, p_puntos_ganados, 'ACUMULACION', 'Puntos por viaje #' || left(p_viaje_id::text, 8));
    END IF;

    -- Devolver JSON con reporte del resultado
    v_resultado := jsonb_build_object(
        'success', true,
        'viaje_gratis_ganado', v_tiene_viaje_gratis,
        'puntos_ganados', p_puntos_ganados,
        'puntos_actuales', v_total_puntos
    );

    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. RPC para calcular totales de ganancias por chofer
-- Utiliza "creado_en < p_fecha_hasta" (límite superior exclusivo)
CREATE OR REPLACE FUNCTION calcular_recaudaciones_chofer(
  p_chofer_id UUID,
  p_fecha_desde TIMESTAMP WITH TIME ZONE,
  p_fecha_hasta TIMESTAMP WITH TIME ZONE
) RETURNS JSONB AS $$
DECLARE
    v_bruta_total NUMERIC := 0;
    v_comisiones NUMERIC := 0;
    v_bruta_con_comision NUMERIC := 0;
    v_viajes_total INT := 0;
    v_viajes_con_comision INT := 0;
    v_viajes_sin_comision INT := 0;
BEGIN
    SELECT 
        COALESCE(SUM(precio), 0),
        COALESCE(SUM(comision_aplicada), 0),
        COALESCE(SUM(precio) FILTER (WHERE comision_aplicada IS NOT NULL), 0),
        COUNT(*),
        COUNT(comision_aplicada),
        COUNT(*) FILTER (WHERE comision_aplicada IS NULL)
    INTO 
        v_bruta_total, 
        v_comisiones, 
        v_bruta_con_comision, 
        v_viajes_total, 
        v_viajes_con_comision, 
        v_viajes_sin_comision
    FROM viajes
    WHERE chofer_id = p_chofer_id
      AND estado = 'FINALIZADO'
      AND creado_en >= p_fecha_desde
      AND creado_en < p_fecha_hasta;

    RETURN jsonb_build_object(
        'recaudacion_bruta_total', v_bruta_total,
        'comisiones_registradas', v_comisiones,
        'recaudacion_con_comision_registrada', v_bruta_con_comision,
        'ganancia_neta_verificable', v_bruta_con_comision - v_comisiones,
        'viajes_total', v_viajes_total,
        'viajes_con_comision_registrada', v_viajes_con_comision,
        'viajes_sin_comision_historica', v_viajes_sin_comision
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Asegurar la RPC: Nadie excepto el backend (service_role) puede invocar esta función
REVOKE EXECUTE ON FUNCTION calcular_recaudaciones_chofer(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION calcular_recaudaciones_chofer(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM anon;
REVOKE EXECUTE ON FUNCTION calcular_recaudaciones_chofer(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM authenticated;
GRANT EXECUTE ON FUNCTION calcular_recaudaciones_chofer(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO service_role;
