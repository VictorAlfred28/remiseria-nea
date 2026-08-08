/**
 * ============================================================
 * BENEFICIOS — Tipos canónicos del módulo de Promociones
 * ============================================================
 * Mapeados 1:1 con la tabla `promociones` real de Supabase
 * (validado contra producción el 2026-06-01).
 *
 * Columnas reales confirmadas en prod (19 columnas):
 *   id, organizacion_id, titulo, descripcion, puntos_requeridos,
 *   creado_en, tipo_descuento, valor_descuento, dias_aplicacion,
 *   horario_inicio, horario_fin, fecha_inicio, fecha_fin,
 *   activa, comercio_id, imagen_url, es_exclusiva_profesionales,
 *   instagram_url, facebook_url
 *
 * Join con comercios — columna real: nombre_comercio (NO nombre)
 * ============================================================
 */

export interface ComercioAdherido {
  id: string;
  nombre_comercio: string;
  rubro: string | null;
  direccion: string | null;
  descripcion: string | null;
  logo_url: string | null;
}

/** Row tal como viene de Supabase (snake_case) — columnas reales de prod */
export interface BeneficioRow {
  id: string;
  organizacion_id: string;
  comercio_id: string | null;

  // Contenido principal
  titulo: string;
  descripcion: string | null;
  puntos_requeridos: number | null;

  // Descuento
  tipo_descuento: 'porcentaje' | 'fijo' | null;
  valor_descuento: number | null;

  // Horarios y vigencia
  dias_aplicacion: string[] | null;
  horario_inicio: string | null;
  horario_fin: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;          // equivalente a vigencia_hasta

  // Imagen y redes (únicas columnas de imagen en prod)
  imagen_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;

  // Flags
  activa: boolean;
  es_exclusiva_profesionales: boolean | null; // equivalente a exclusivo_ubi

  // Metadatos
  creado_en: string;                  // nombre real en prod (no created_at)

  // Join opcional con comercios (campo real: nombre_comercio)
  comercios?: {
    id: string;
    nombre_comercio: string;          // nombre real en prod (no nombre)
    organizacion_id: string;
    rubro: string | null;
    logo_url: string | null;
    direccion: string | null;
  } | null;
}

/**
 * Beneficio normalizado para consumo en componentes UI.
 * Construido a partir de BeneficioRow con defaults seguros.
 */
export interface Beneficio {
  id: string;
  organizacionId: string;
  comercioId: string | null;
  comercioNombre: string;
  comercioRubro: string;
  comercioLogo: string | null;
  comercioDireccion: string | null;

  // Contenido
  titulo: string;
  descripcion: string;
  puntosRequeridos: number;
  categoria: string;             // fallback visual: siempre 'Promoción' para datos reales
  iconName: string;              // fallback visual: siempre 'Tag' para datos reales

  // Colores dinámicos (derivados de tipo_descuento como fallback visual)
  accentColorHex: string;
  gradientFromHex: string;
  gradientToHex: string;

  // Tailwind classes (estáticas para safelist)
  borderColor: string;
  hoverBorderColor: string;
  iconColor: string;
  glowColor: string;
  hoverGlowColor: string;
  bgGradient: string;
  btnHoverBg: string;
  btnHoverBorder: string;

  // Descuento
  descuentoLabel: string;
  descuentoSublabel: string;
  tipoDescuento: 'porcentaje' | 'fijo' | null;
  valorDescuento: number;

  // Imagen (única columna de imagen disponible: imagen_url)
  imagenBanner: string;
  imagenProducto: string;

  // Vigencia (derivado de fecha_fin)
  vigencia: string;

  // Redes sociales
  instagramUrl: string | null;
  facebookUrl: string | null;

  // Horarios
  horarioInicio: string | null;
  horarioFin: string | null;

  // Flags
  activa: boolean;
  esExclusivoProfesionales: boolean;

  // Compatibilidad legacy (arrays vacíos seguros para componentes que los esperaban)
  sucursales: string[];
  condiciones: string[];
  productos: string[];
  destacado: boolean;
  esExclusivo: boolean;
}

// ── Paleta de colores por tipo de descuento (fallback visual) ───────────────
const TYPE_COLORS: Record<string, { hex: string; from: string; to: string }> = {
  porcentaje: { hex: '#10b981', from: '#064e3b', to: '#0a0d14' },
  fijo:       { hex: '#06b6d4', from: '#164e63', to: '#0a0d14' },
  default:    { hex: '#6366f1', from: '#312e81', to: '#0a0d14' },
};

// ── Placeholder SVG inline ───────────────────────────────────────────────────
export const PLACEHOLDER_BANNER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#111827"/>
        <stop offset="100%" stop-color="#030712"/>
      </linearGradient>
    </defs>
    <rect width="800" height="450" fill="url(#g)"/>
    <text x="400" y="210" text-anchor="middle" font-family="system-ui" font-size="48" fill="#374151">🎁</text>
    <text x="400" y="260" text-anchor="middle" font-family="system-ui" font-size="16" fill="#6b7280">Imagen próximamente</text>
  </svg>`);

/**
 * Transforma un BeneficioRow (columnas reales de Supabase) en un Beneficio UI.
 * Aplica defaults seguros para todos los campos opcionales.
 */
export function rowToBeneficio(row: BeneficioRow): Beneficio {
  const tipo    = row.tipo_descuento ?? 'default';
  const colors  = TYPE_COLORS[tipo] ?? TYPE_COLORS.default;
  const valor   = Number(row.valor_descuento ?? 0);

  // Construir etiqueta de descuento desde los campos reales disponibles
  const descuentoLabel =
    tipo === 'porcentaje' ? `${valor}% OFF` :
    tipo === 'fijo'       ? `$${valor} OFF` :
    'Promoción';

  // Vigencia desde fecha_fin (campo real en prod)
  const vigencia = row.fecha_fin
    ? `Válido hasta ${new Date(row.fecha_fin).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })}`
    : 'Sin fecha de vencimiento';

  // Imagen: única columna disponible en prod es imagen_url
  const imagen = row.imagen_url || PLACEHOLDER_BANNER;

  return {
    id:                  row.id,
    organizacionId:      row.organizacion_id,
    comercioId:          row.comercio_id,
    comercioNombre:      row.comercios?.nombre_comercio || 'Comercio Adherido',
    comercioRubro:       row.comercios?.rubro           || '',
    comercioLogo:        row.comercios?.logo_url        || null,
    comercioDireccion:   row.comercios?.direccion       || null,

    titulo:              row.titulo,
    descripcion:         row.descripcion  || '',
    puntosRequeridos:    row.puntos_requeridos ?? 0,
    categoria:           'Promoción',    // campo no existe en prod — fallback estático
    iconName:            'Tag',          // campo no existe en prod — fallback estático

    accentColorHex:      colors.hex,
    gradientFromHex:     colors.from,
    gradientToHex:       colors.to,

    // Clases Tailwind estáticas (sin Tailwind JIT dinámico)
    borderColor:         'border-white/10',
    hoverBorderColor:    'hover:border-white/20',
    iconColor:           'text-white',
    glowColor:           'bg-white/5',
    hoverGlowColor:      'group-hover:bg-white/10',
    bgGradient:          'from-white/5 to-transparent',
    btnHoverBg:          'hover:bg-white/10',
    btnHoverBorder:      'hover:border-white/20',

    descuentoLabel,
    descuentoSublabel:   '',
    tipoDescuento:       row.tipo_descuento,
    valorDescuento:      valor,

    imagenBanner:        imagen,
    imagenProducto:      imagen,

    vigencia,

    instagramUrl:        row.instagram_url  || null,
    facebookUrl:         row.facebook_url   || null,
    horarioInicio:       row.horario_inicio || null,
    horarioFin:          row.horario_fin    || null,

    activa:                    row.activa ?? true,
    esExclusivoProfesionales:  row.es_exclusiva_profesionales ?? false,

    // Campos de compatibilidad legacy
    sucursales:  [],
    condiciones: [],
    productos:   [],
    destacado:   false,
    esExclusivo: row.es_exclusiva_profesionales ?? false,
  };
}
