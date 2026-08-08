/**
 * Utilidades centralizadas para normalización de estados de viaje.
 * Mantiene compatibilidad temporal para comparaciones.
 */

// Mapeo identity
const ESTADO_MAP: Record<string, string> = {
  'SOLICITADO': 'SOLICITADO',
  'ACEPTADO': 'ACEPTADO',
  'EN_PUERTA': 'EN_PUERTA',
  'INICIADO': 'INICIADO',
  'FINALIZADO': 'FINALIZADO',
  'CANCELADO': 'CANCELADO',
  'RECHAZADO': 'RECHAZADO',
  'ESPERANDO_TUTOR': 'ESPERANDO_TUTOR'
};

// Estados considerados "activos" (viaje en curso)
const ESTADOS_ACTIVOS = new Set([
  'SOLICITADO',
  'ACEPTADO',
  'EN_PUERTA',
  'INICIADO',
  'ESPERANDO_TUTOR',
]);

// Estados considerados "finalizados" (viaje terminado)
const ESTADOS_FINALIZADOS = new Set([
  'FINALIZADO',
]);

// Estados considerados "cerrados" (finalizados + cancelados + rechazados)
const ESTADOS_CERRADOS = new Set([
  'FINALIZADO',
  'CANCELADO',
  'RECHAZADO',
]);

// Estados considerados "pendientes" (esperando asignación)
const ESTADOS_PENDIENTES = new Set([
  'SOLICITADO',
  'ESPERANDO_TUTOR',
]);

/**
 * Normaliza un estado legacy a su equivalente definitivo en español.
 */
export function normalizeEstado(estado: string): string {
  return ESTADO_MAP[estado] || estado;
}

/** Verifica si el estado indica un viaje activo */
export function isEstadoActivo(estado: string): boolean {
  return ESTADOS_ACTIVOS.has(normalizeEstado(estado));
}

/** Verifica si el estado indica un viaje finalizado */
export function isEstadoFinalizado(estado: string): boolean {
  return ESTADOS_FINALIZADOS.has(normalizeEstado(estado));
}

/** Verifica si el estado indica un viaje cerrado (finalizado, cancelado, rechazado) */
export function isEstadoCerrado(estado: string): boolean {
  return ESTADOS_CERRADOS.has(normalizeEstado(estado));
}

/** Verifica si el estado indica un viaje pendiente */
export function isEstadoPendiente(estado: string): boolean {
  return ESTADOS_PENDIENTES.has(normalizeEstado(estado));
}

/**
 * Formatea un estado para mostrar al usuario (texto legible).
 */
export function formatEstado(estado: string): string {
  const norm = normalizeEstado(estado);
  switch (norm) {
    case 'SOLICITADO': return 'Buscando chofer';
    case 'ACEPTADO': return 'Chofer en camino';
    case 'EN_PUERTA': return 'Chofer en la puerta';
    case 'INICIADO': return 'Viaje en curso';
    case 'FINALIZADO': return 'Viaje finalizado';
    case 'CANCELADO': return 'Viaje cancelado';
    case 'RECHAZADO': return '❌ Viaje rechazado por tutor';
    case 'ESPERANDO_TUTOR': return '🛡️ Esperando aprobación de tutor';
    default: return norm;
  }
}
