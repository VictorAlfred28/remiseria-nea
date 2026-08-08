/**
 * ============================================================
 * useBeneficios — Hook React para el módulo de Beneficios
 * ============================================================
 * Conecta con Supabase vía beneficiosService.
 * Implementa:
 *   ✓ carga inicial
 *   ✓ suscripción realtime (cambios en `promociones`)
 *   ✓ fallback a mock data si Supabase está vacío (modo demo)
 *   ✓ estados: data, loading, error
 *   ✓ cleanup de suscripción al desmontar
 * ============================================================
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getBeneficiosActivos, getComerciosAdheridos } from '../services/beneficiosService';
import { rowToBeneficio } from '../types/beneficios';
import type { Beneficio, ComercioAdherido } from '../types/beneficios';
import { MOCK_BENEFICIOS } from '../components/promociones/promocionesMock';

export interface UseBeneficiosResult {
  beneficios: Beneficio[];
  comerciosAdheridos: ComercioAdherido[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  usingMock: boolean;     // true cuando se están mostrando datos de demostración
}

/**
 * Hook principal para cargar y suscribirse a beneficios/promociones.
 *
 * @param organizacionId - UUID de la organización del usuario.
 *                         Si es undefined/null, retorna datos mock mientras carga.
 */
export function useBeneficios(organizacionId: string | null | undefined): UseBeneficiosResult {
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [comerciosAdheridos, setComerciosAdheridos] = useState<ComercioAdherido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [usingMock, setUsingMock]   = useState(false);
  const channelRef                  = useRef<any>(null);

  const fetchBeneficios = useCallback(async () => {
    if (!organizacionId) {
      // Sin org_id todavía (sesión cargando) — mostramos mock mientras tanto
      setBeneficios(MOCK_BENEFICIOS);
      setComerciosAdheridos([]);
      setUsingMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [rows, comerciosRows] = await Promise.all([
        getBeneficiosActivos(organizacionId),
        getComerciosAdheridos(organizacionId)
      ]);

      setComerciosAdheridos(comerciosRows);

      if (rows.length === 0) {
        // Supabase OK pero sin datos — modo demo con mock para beneficios
        setBeneficios(MOCK_BENEFICIOS);
        setUsingMock(true);
      } else {
        setBeneficios(rows.map(rowToBeneficio));
        setUsingMock(false);
      }
    } catch (err: any) {
      console.error('[useBeneficios] Error inesperado:', err);
      setError('No se pudieron cargar los datos.');
      // Fallback al mock para no dejar la UI vacía
      setBeneficios(MOCK_BENEFICIOS);
      setComerciosAdheridos([]);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [organizacionId]);

  // ── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    fetchBeneficios();
  }, [fetchBeneficios]);

  // ── Suscripción Realtime ─────────────────────────────────────
  // Solo suscribirse cuando tenemos org_id real
  useEffect(() => {
    if (!organizacionId) return;

    // Limpiar canal anterior si cambia org
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`beneficios_org_${organizacionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',           // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'promociones',
          filter: `organizacion_id=eq.${organizacionId}`,
        },
        (_payload) => {
          // Cualquier cambio en promociones de esta org → refetch
          fetchBeneficios();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',           // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'comercios',
          filter: `organizacion_id=eq.${organizacionId}`,
        },
        (_payload) => {
          // Cualquier cambio en comercios de esta org → refetch
          fetchBeneficios();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizacionId, fetchBeneficios]);

  return {
    beneficios,
    comerciosAdheridos,
    loading,
    error,
    refetch: fetchBeneficios,
    usingMock,
  };
}
