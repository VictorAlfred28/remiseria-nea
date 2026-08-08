/**
 * ============================================================
 * promocionesMock.ts — Datos de demostración temporales
 * ============================================================
 * ⚠ MODO DEMO: Este archivo se usa SOLO como fallback cuando:
 *   1. Supabase no tiene promociones en la tabla `promociones`
 *   2. El usuario no tiene organización asignada todavía
 *   3. Hay un error de conexión a Supabase
 *
 * Cuando los comercios carguen promociones reales en la DB,
 * este mock deja de usarse automáticamente (ver useBeneficios.ts).
 *
 * ESTRUCTURA: Implementa el tipo `Beneficio` canónico del módulo,
 * por lo que sirve de referencia/documentación del modelo de datos.
 * ============================================================
 */
import type { Beneficio } from '../../types/beneficios';

// Imágenes generadas para modo demo — en producción vienen de Supabase Storage
import promoCombustible from '../../assets/promo_combustible.png';
import promoLavado      from '../../assets/promo_lavado.png';
import promoGomeria     from '../../assets/promo_gomeria.png';
import promoGastronomia from '../../assets/promo_gastronomia.png';

/**
 * MOCK_BENEFICIOS: Array de demostración.
 * Usado automáticamente por useBeneficios() cuando Supabase está vacío.
 */
export const MOCK_BENEFICIOS: Beneficio[] = [
  {
    id: 'demo_promo_1',
    organizacionId: 'demo',
    comercioId:     null,
    comercioNombre: 'Estaciones Sur',

    titulo:      '15% OFF en Combustible',
    descripcion: 'Presentando tu app UBI obtenés un 15% de descuento cargando V-Power.',
    categoria:   'Combustible',
    iconName:    'Fuel',

    accentColorHex:  '#10b981',
    gradientFromHex: '#064e3b',
    gradientToHex:   '#0a0d14',

    borderColor:      'border-emerald-500/30',
    hoverBorderColor: 'hover:border-emerald-500/50',
    iconColor:        'text-emerald-400',
    glowColor:        'bg-emerald-500/10',
    hoverGlowColor:   'group-hover:bg-emerald-500/20',
    bgGradient:       'from-emerald-500/20 to-transparent',
    btnHoverBg:       'hover:bg-emerald-500/20',
    btnHoverBorder:   'hover:border-emerald-500/30',

    descuentoLabel:    '15% OFF',
    descuentoSublabel: 'en cada carga',

    imagenBanner:   promoCombustible,
    imagenProducto: promoCombustible,

    vigencia:    'Válido hasta 30/06/2025',
    sucursales:  ['Av. San Martín 1200', 'Ruta 9 km 45 — Acceso Norte', 'Terminal de Ómnibus'],
    condiciones: [
      'Mostrar app UBI al momento de cargar combustible.',
      'Válido para cargas mayores a $3.000.',
      'No acumulable con otras promociones.',
      'Máximo 2 usos semanales por usuario.',
    ],
    productos: ['V-Power Diesel', 'V-Power Nafta', 'Combustible Común'],

    activa:      true,
    destacado:   true,
    esExclusivo: true,
  },
  {
    id: 'demo_promo_2',
    organizacionId: 'demo',
    comercioId:     null,
    comercioNombre: 'CarWash Premium',

    titulo:      'Lavado Completo 2x1',
    descripcion: 'Lavá tu vehículo y lleváte el próximo lavado sin cargo.',
    categoria:   'Lavadero',
    iconName:    'Droplets',

    accentColorHex:  '#06b6d4',
    gradientFromHex: '#164e63',
    gradientToHex:   '#0a0d14',

    borderColor:      'border-cyan-500/30',
    hoverBorderColor: 'hover:border-cyan-500/50',
    iconColor:        'text-cyan-400',
    glowColor:        'bg-cyan-500/10',
    hoverGlowColor:   'group-hover:bg-cyan-500/20',
    bgGradient:       'from-cyan-500/20 to-transparent',
    btnHoverBg:       'hover:bg-cyan-500/20',
    btnHoverBorder:   'hover:border-cyan-500/30',

    descuentoLabel:    '2 x 1',
    descuentoSublabel: 'llevás el siguiente gratis',

    imagenBanner:   promoLavado,
    imagenProducto: promoLavado,

    vigencia:    'Válido hasta 15/07/2025',
    sucursales:  ['Av. Lavalle 890 — Local Central', 'Shopping Norte — Planta Baja'],
    condiciones: [
      'El segundo lavado se aplica en la visita siguiente.',
      'El comprobante se registra en tu perfil UBI automáticamente.',
      'Válido de lunes a viernes de 8:00 a 18:00 hs.',
      'No aplicable en días feriados.',
    ],
    productos: ['Lavado Exterior Completo', 'Aspirado Interior', 'Encerado Premium', 'Limpieza de tapizados'],

    activa:      true,
    destacado:   false,
    esExclusivo: true,
  },
  {
    id: 'demo_promo_3',
    organizacionId: 'demo',
    comercioId:     null,
    comercioNombre: 'La Gomería Central',

    titulo:      'Alineación y Balanceo',
    descripcion: 'Descuento especial del 30% para la flota de UBI Traslados.',
    categoria:   'Taller',
    iconName:    'Wrench',

    accentColorHex:  '#f97316',
    gradientFromHex: '#7c2d12',
    gradientToHex:   '#0a0d14',

    borderColor:      'border-orange-500/30',
    hoverBorderColor: 'hover:border-orange-500/50',
    iconColor:        'text-orange-400',
    glowColor:        'bg-orange-500/10',
    hoverGlowColor:   'group-hover:bg-orange-500/20',
    bgGradient:       'from-orange-500/20 to-transparent',
    btnHoverBg:       'hover:bg-orange-500/20',
    btnHoverBorder:   'hover:border-orange-500/30',

    descuentoLabel:    '30% OFF',
    descuentoSublabel: 'flota UBI exclusivo',

    imagenBanner:   promoGomeria,
    imagenProducto: promoGomeria,

    vigencia:    'Sin fecha de vencimiento',
    sucursales:  ['Av. Independencia 2400 — Taller Central'],
    condiciones: [
      'Identificarte como chofer de UBI al solicitar el servicio.',
      'Previa coordinación de turno vía WhatsApp.',
      'Válido para vehículos afectados a la flota activa.',
      'Máximo 1 servicio por vehículo por mes.',
    ],
    productos: ['Alineación 3D de 4 ruedas', 'Balanceo computarizado', 'Rotación de neumáticos', 'Revisión de presión'],

    activa:      true,
    destacado:   true,
    esExclusivo: false,
  },
  {
    id: 'demo_promo_4',
    organizacionId: 'demo',
    comercioId:     null,
    comercioNombre: 'Burger House',

    titulo:      'Menú Especial Chofer',
    descripcion: 'Pasá por el Auto-Mac y lleváte tu menú con 50% de descuento.',
    categoria:   'Gastronomía',
    iconName:    'Utensils',

    accentColorHex:  '#f43f5e',
    gradientFromHex: '#881337',
    gradientToHex:   '#0a0d14',

    borderColor:      'border-rose-500/30',
    hoverBorderColor: 'hover:border-rose-500/50',
    iconColor:        'text-rose-400',
    glowColor:        'bg-rose-500/10',
    hoverGlowColor:   'group-hover:bg-rose-500/20',
    bgGradient:       'from-rose-500/20 to-transparent',
    btnHoverBg:       'hover:bg-rose-500/20',
    btnHoverBorder:   'hover:border-rose-500/30',

    descuentoLabel:    '50% OFF',
    descuentoSublabel: 'menú completo',

    imagenBanner:   promoGastronomia,
    imagenProducto: promoGastronomia,

    vigencia:    'Válido hasta 31/05/2025',
    sucursales:  ['Av. Córdoba 550 — Drive-Thru 24hs', 'Shopping Sur — Food Court'],
    condiciones: [
      'Solo válido para choferes activos de UBI.',
      'Mostrar badge verde "En Turno" en la app.',
      'Máximo 1 menú por turno de trabajo.',
      'No combinable con cupones externos.',
    ],
    productos: ['Burger House Especial', 'Papas Grandes', 'Bebida 500ml', 'Postre a elección'],

    activa:      true,
    destacado:   false,
    esExclusivo: true,
  },
];

/**
 * @deprecated — Alias de compatibilidad.
 * Usar MOCK_BENEFICIOS en código nuevo.
 * Este export existe para no romper imports existentes durante la transición.
 */
export const mockPromociones = MOCK_BENEFICIOS;
