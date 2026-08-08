/**
 * ============================================================
 * beneficiosService.ts — Capa de acceso a datos Supabase
 * ============================================================
 * Único punto de contacto con la tabla `promociones`.
 * Todos los componentes consumen datos a través de este servicio
 * o del hook useBeneficios que lo envuelve.
 *
 * SELECT_FIELDS validado contra columnas reales en producción
 * (verificado el 2026-06-01 — 19 columnas reales en prod).
 * ============================================================
 */
import { supabase } from '../lib/supabase';
import type { BeneficioRow, ComercioAdherido } from '../types/beneficios';

/**
 * Campos seleccionados de `promociones`.
 * Incluye ÚNICAMENTE columnas que existen en la tabla real de producción.
 * Join con `comercios` usando el nombre real de la columna: nombre_comercio.
 */
const SELECT_FIELDS = `
  id,
  organizacion_id,
  comercio_id,
  titulo,
  descripcion,
  puntos_requeridos,
  tipo_descuento,
  valor_descuento,
  dias_aplicacion,
  horario_inicio,
  horario_fin,
  fecha_inicio,
  fecha_fin,
  activa,
  imagen_url,
  es_exclusiva_profesionales,
  instagram_url,
  facebook_url,
  creado_en,
  comercios ( id, nombre_comercio, organizacion_id, rubro, logo_url, direccion )
`;

/**
 * Obtiene todas las promociones activas de una organización.
 * Ordena por fecha de creación descendente (campo real: creado_en).
 *
 * @param organizacionId - UUID de la organización del usuario autenticado
 * @returns BeneficioRow[] o [] en caso de error
 */
export async function getBeneficiosActivos(
  organizacionId: string
): Promise<BeneficioRow[]> {
  const { data, error } = await supabase
    .from('promociones')
    .select(SELECT_FIELDS)
    .eq('organizacion_id', organizacionId)
    .eq('activa', true)
    .order('creado_en', { ascending: false });

  if (error) {
    // Solo logueamos — no propagamos para no romper la UI
    console.error('[beneficiosService] Error al cargar beneficios:', error.message);
    return [];
  }

  return (data as BeneficioRow[]) ?? [];
}

/**
 * Obtiene los comercios adheridos reales (registrados desde Mi Negocio y aprobados por Admin).
 * 
 * @param organizacionId - UUID de la organización
 * @returns Lista de comercios activos
 */
export async function getComerciosAdheridos(
  organizacionId: string
): Promise<ComercioAdherido[]> {
  const { data, error } = await supabase
    .from('comercios')
    .select('id, nombre_comercio, rubro, direccion, descripcion, logo_url')
    .eq('organizacion_id', organizacionId)
    .eq('estado', 'ACTIVO')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('[beneficiosService] Error al cargar comercios adheridos:', error.message);
    return [];
  }

  return (data as ComercioAdherido[]) ?? [];
}

/**
 * Obtiene el detalle de una promoción por ID.
 *
 * @param id - UUID de la promoción
 * @returns BeneficioRow | null
 */
export async function getBeneficioById(id: string): Promise<BeneficioRow | null> {
  const { data, error } = await supabase
    .from('promociones')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .single();

  if (error) {
    console.error('[beneficiosService] Error al cargar beneficio:', error.message);
    return null;
  }

  return data as BeneficioRow;
}

/**
 * Registra que un usuario activó/vio un beneficio.
 * Inserta en `historial_escaneos_socios` para analytics futuros.
 *
 * @param beneficioId    - UUID de la promoción
 * @param clienteId      - UUID del usuario que activó
 * @param organizacionId - UUID de la organización
 */
export async function registrarActivacionBeneficio(
  beneficioId: string,
  clienteId: string,
  organizacionId: string
): Promise<void> {
  const { error } = await supabase
    .from('historial_escaneos_socios')
    .insert({
      comercio_id: beneficioId,   // re-uso del campo hasta que se agregue beneficio_id
      cliente_id: clienteId,
      organizacion_id: organizacionId,
      beneficio_aplicado: beneficioId,
    });

  if (error) {
    console.warn('[beneficiosService] No se pudo registrar activación:', error.message);
    // No propagamos — es analytics opcional
  }
}
