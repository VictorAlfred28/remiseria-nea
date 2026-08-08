-- ==============================================================================
-- MIGRACIÓN PARA ENCAPSULAR EL CIERRE DE VIAJES Y MEJORAR EL RENDIMIENTO X10
-- Reduce el problema N+1 eliminando las 8 llamadas HTTP a la BD por una sola.
-- ==============================================================================

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
    SET estado = 'FINISHED',
        finished_at = NOW(),
        fecha_fin_viaje = NOW(),
        wait_minutes = p_wait_minutes,
        wait_cost = p_wait_cost,
        final_price = p_final_price,
        precio = p_final_price,
        puntos_generados = p_puntos_ganados
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

    -- Devolver JSON con reporte del resultado para emitir en Python (ej: WhatsApp si ganó un viaje gratis)
    v_resultado := jsonb_build_object(
        'success', true,
        'viaje_gratis_ganado', v_tiene_viaje_gratis,
        'puntos_ganados', p_puntos_ganados,
        'puntos_actuales', v_total_puntos
    );

    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
