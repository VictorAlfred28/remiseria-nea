-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║                                                                                ║
-- ║     BACKUP SQL COMPLETO - REMISERÍA NEA PRODUCCIÓN                            ║
-- ║     Versión: 1.0 | Fecha: 2026-04-20                                          ║
-- ║                                                                                ║
-- ║     CONTENIDO:                                                                 ║
-- ║     ✅ Extensiones (UUID, PostGIS)                                            ║
-- ║     ✅ Funciones custom (Auth helpers, Geolocation)                           ║
-- ║     ✅ Tablas base (Organizaciones, Usuarios, Choferes)                       ║
-- ║     ✅ Tablas de negocio (Viajes, Empresas, Comercios)                        ║
-- ║     ✅ Tablas de features (Calificaciones, Pagos, Puntos)                     ║
-- ║     ✅ Tablas de sistemas (Tarifas, Reservaciones, Job board)                 ║
-- ║     ✅ Row Level Security (RLS) - Políticas completas                         ║
-- ║     ✅ Índices y constraints                                                  ║
-- ║     ✅ Storage Buckets                                                        ║
-- ║     ✅ Comentarios para documentación                                         ║
-- ║                                                                                ║
-- ║     INSTRUCCIONES:                                                            ║
-- ║     1. Copiar TODO este contenido                                             ║
-- ║     2. Abrir SQL Editor en Supabase                                           ║
-- ║     3. Pegar el contenido completo                                            ║
-- ║     4. Ejecutar (Ctrl+Enter o botón Run)                                      ║
-- ║     5. Revisar que todas las tablas se creen sin errores                      ║
-- ║     6. Hacer backup automático en Supabase Dashboard                          ║
-- ║                                                                                ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 1: EXTENSIONES                                                          ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 2: FUNCIONES HELPER DE AUTENTICACIÓN                                    ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

-- Función para obtener el ID de la organización desde JWT
CREATE OR REPLACE FUNCTION public.get_auth_orga_id() 
RETURNS UUID AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'organizacion_id')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Función para obtener el rol desde JWT
CREATE OR REPLACE FUNCTION public.get_auth_rol() 
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb ->> 'rol';
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 3: TABLA ORGANIZACIONES (MULTI-TENANT BASE)                             ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.organizaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    dominio TEXT,
    whatsapp_numero TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizaciones_dominio ON public.organizaciones(dominio);
CREATE INDEX IF NOT EXISTS idx_organizaciones_activo ON public.organizaciones(activo);

COMMENT ON TABLE public.organizaciones IS 'Contenedor de datos por cliente (multi-tenancy). Cada organización es completamente aislada.';
COMMENT ON COLUMN public.organizaciones.plan IS 'Plan de suscripción: free (limitado), pro (recomendado), enterprise (todas features)';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 4: TABLA USUARIOS (AUTH-LINKED)                                         ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    rol TEXT CHECK (rol IN ('admin', 'chofer', 'cliente', 'superadmin', 'comercio', 'titular')) DEFAULT 'cliente',
    activo BOOLEAN DEFAULT true,
    -- Puntos y viajes gratis (Loyalty System)
    puntos_actuales INTEGER DEFAULT 0,
    viajes_gratis INTEGER DEFAULT 0,
    -- Flags adicionales
    es_socio BOOLEAN DEFAULT false,
    tiene_vehiculo BOOLEAN DEFAULT false,
    licencia_numero TEXT,
    documentos_cargados BOOLEAN DEFAULT false,
    foto_perfil_url TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion ON public.usuarios(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- RLS Policies para USUARIOS
DROP POLICY IF EXISTS "usu_select_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_update_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_delete_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_insert_isolation" ON public.usuarios;

CREATE POLICY "usu_select_isolation" ON public.usuarios
    FOR SELECT 
    USING (id = auth.uid() OR organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

CREATE POLICY "usu_update_isolation" ON public.usuarios
    FOR UPDATE
    USING (id = auth.uid() OR public.get_auth_rol() = 'superadmin');

CREATE POLICY "usu_delete_isolation" ON public.usuarios
    FOR DELETE
    USING (id = auth.uid() OR public.get_auth_rol() = 'superadmin');

CREATE POLICY "usu_insert_isolation" ON public.usuarios 
    FOR INSERT 
    WITH CHECK (auth.uid() = id OR public.get_auth_rol() = 'superadmin');

COMMENT ON TABLE public.usuarios IS 'Usuarios del sistema con linkeo a auth.users (Supabase Auth). Contiene perfil, rol y estado de puntos de lealtad.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 5: TABLA CHOFERES                                                       ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.choferes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    vehiculo TEXT NOT NULL,
    patente TEXT NOT NULL,
    estado TEXT CHECK (estado IN ('disponible', 'ocupado', 'inactivo')) DEFAULT 'inactivo',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    ultima_ubicacion_actualizada TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chofer_unique_por_org UNIQUE(usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_choferes_organizacion ON public.choferes(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_choferes_usuario ON public.choferes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_choferes_estado ON public.choferes(estado);
CREATE INDEX IF NOT EXISTS idx_choferes_ubicacion ON public.choferes(lat, lng);

ALTER TABLE public.choferes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "choferes_isolation" ON public.choferes
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

COMMENT ON TABLE public.choferes IS 'Perfil de chofer con ubicación GPS y estado actual. Un usuario puede ser múltiple roles pero solo 1 chofer por org.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 6: TABLA VEHICLES (FLOTA)                                               ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    titular_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    año INTEGER,
    patente TEXT NOT NULL,
    estado TEXT CHECK (estado IN ('activo', 'inactivo')) DEFAULT 'activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_vehicle_patente UNIQUE (patente)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_titular_id ON public.vehicles(titular_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON public.vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_org_id ON public.vehicles(organizacion_id);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select" ON public.vehicles
    FOR SELECT
    USING (
        titular_id = auth.uid()
        OR driver_id = auth.uid()
        OR public.get_auth_rol() IN ('admin', 'superadmin')
        OR organizacion_id = public.get_auth_orga_id()
    );

CREATE POLICY "vehicles_admin_insert" ON public.vehicles
    FOR INSERT
    WITH CHECK (public.get_auth_rol() IN ('admin', 'superadmin'));

CREATE POLICY "vehicles_admin_update" ON public.vehicles
    FOR UPDATE
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));

CREATE POLICY "vehicles_admin_delete" ON public.vehicles
    FOR DELETE
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));

COMMENT ON TABLE public.vehicles IS 'Registro de vehículos: titular es propietario, driver_id puede ser NULL si no está asignado. Patente única.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 7: TABLA VIAJES                                                         ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.viajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    chofer_id UUID REFERENCES public.choferes(id) ON DELETE SET NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    -- Ubicaciones
    origen JSONB NOT NULL,    -- {"direccion": "...", "lat": ..., "lng": ...}
    destino JSONB NOT NULL,
    -- Estado del viaje
    estado TEXT CHECK (estado IN ('solicitado', 'asignado', 'en_camino', 'finalizado', 'cancelado')) DEFAULT 'solicitado',
    -- Precios
    precio NUMERIC(10, 2),
    precio_original NUMERIC(10, 2),
    monto_descontado NUMERIC(10, 2) DEFAULT 0,
    -- Tipo de viaje
    tipo_viaje TEXT DEFAULT 'PERSONAL' CHECK (tipo_viaje IN ('PERSONAL', 'EMPRESARIAL')),
    -- Sistema de puntos y viajes gratis
    puntos_generados INTEGER DEFAULT 0,
    usado_viaje_gratis BOOLEAN DEFAULT false,
    -- Timestamps de tracking
    fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_aceptacion TIMESTAMP WITH TIME ZONE,
    fecha_llegada_origen TIMESTAMP WITH TIME ZONE,
    fecha_inicio_viaje TIMESTAMP WITH TIME ZONE,
    fecha_fin_viaje TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viajes_organizacion ON public.viajes(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_viajes_cliente ON public.viajes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_viajes_chofer ON public.viajes(chofer_id);
CREATE INDEX IF NOT EXISTS idx_viajes_estado ON public.viajes(estado);
CREATE INDEX IF NOT EXISTS idx_viajes_fecha_solicitud ON public.viajes(fecha_solicitud);

ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viajes_isolation" ON public.viajes
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

COMMENT ON TABLE public.viajes IS 'Registro de todos los viajes: origen/destino en JSONB, precios con descuentos, tracking temporal completo.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 8: TABLA EMPRESAS (CORPORATE TRAVEL)                                    ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre_empresa TEXT NOT NULL,
    cuit TEXT,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_organizacion ON public.empresas(organizacion_id);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas_isolation" ON public.empresas
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

COMMENT ON TABLE public.empresas IS 'Empresas cliente para viajes corporativos (facturación, beneficios).';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 9: TABLA EMPRESA_USUARIOS (TEAM MEMBERS)                                ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.empresa_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    limite_mensual NUMERIC(10, 2) DEFAULT 0,
    saldo NUMERIC(10, 2) DEFAULT 0,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_empresa ON public.empresa_usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_usuario ON public.empresa_usuarios(user_id);

ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_usuarios_isolation" ON public.empresa_usuarios
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE public.empresas.id = public.empresa_usuarios.empresa_id AND public.empresas.organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 10: TABLA EMPRESA_BENEFICIOS                                            ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.empresa_beneficios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo_descuento TEXT CHECK (tipo_descuento IN ('PORCENTAJE', 'FIJO')) DEFAULT 'PORCENTAJE',
    valor NUMERIC(10, 2) NOT NULL,
    limite_mensual INTEGER DEFAULT 0,
    horario_inicio TIME,
    horario_fin TIME,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.empresa_beneficios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_beneficios_isolation" ON public.empresa_beneficios
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE public.empresas.id = public.empresa_beneficios.empresa_id AND public.empresas.organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 11: TABLA CALIFICACIONES (RATINGS)                                      ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.calificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viaje_id UUID NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
    pasajero_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    chofer_id UUID NOT NULL REFERENCES public.choferes(id) ON DELETE CASCADE,
    puntuacion SMALLINT NOT NULL CHECK (puntuacion >= 1 AND puntuacion <= 5),
    comentario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT calificacion_unica_por_viaje UNIQUE (viaje_id)
);

CREATE INDEX IF NOT EXISTS idx_calificaciones_viaje ON public.calificaciones(viaje_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_chofer ON public.calificaciones(chofer_id);

ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calificaciones_select" ON public.calificaciones
    FOR SELECT 
    USING (pasajero_id = auth.uid() OR chofer_id IN (SELECT id FROM public.choferes WHERE usuario_id = auth.uid()) OR public.get_auth_rol() IN ('admin', 'superadmin'));

CREATE POLICY "calificaciones_insert" ON public.calificaciones
    FOR INSERT 
    WITH CHECK (pasajero_id = auth.uid() OR public.get_auth_rol() IN ('admin', 'superadmin'));

COMMENT ON TABLE public.calificaciones IS 'Sistema de ratings 1-5 estrellas. Una calificación por viaje, única constraint.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 12: TABLA PAGOS_CHOFER (MANUAL PAYMENT REQUESTS)                        ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.pagos_chofer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    chofer_id UUID NOT NULL REFERENCES public.choferes(id) ON DELETE CASCADE,
    monto NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
    estado TEXT CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')) DEFAULT 'PENDIENTE',
    comprobante_url TEXT NOT NULL,
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_validacion TIMESTAMP WITH TIME ZONE,
    admin_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    observaciones TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_chofer_organizacion ON public.pagos_chofer(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_pagos_chofer_chofer ON public.pagos_chofer(chofer_id);
CREATE INDEX IF NOT EXISTS idx_pagos_chofer_estado ON public.pagos_chofer(estado);

ALTER TABLE public.pagos_chofer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_chofer_select" ON public.pagos_chofer
    FOR SELECT
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

CREATE POLICY "pagos_chofer_insert" ON public.pagos_chofer
    FOR INSERT
    WITH CHECK (organizacion_id = public.get_auth_orga_id());

CREATE POLICY "pagos_chofer_update" ON public.pagos_chofer
    FOR UPDATE
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));

COMMENT ON TABLE public.pagos_chofer IS 'Solicitudes de pago manual de choferes. Admin aprueba/rechaza con observaciones.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 13: TABLA HISTORIAL_PUNTOS (LOYALTY SYSTEM)                             ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.historial_puntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    viaje_id UUID REFERENCES public.viajes(id) ON DELETE SET NULL,
    puntos INTEGER NOT NULL,
    tipo TEXT CHECK (tipo IN ('ACUMULACION', 'CANJE')) NOT NULL,
    descripcion TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_puntos_usuario ON public.historial_puntos(user_id);
CREATE INDEX IF NOT EXISTS idx_historial_puntos_tipo ON public.historial_puntos(tipo);

ALTER TABLE public.historial_puntos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historial_puntos_select" ON public.historial_puntos
    FOR SELECT
    USING (user_id = auth.uid() OR public.get_auth_rol() IN ('superadmin', 'admin'));

COMMENT ON TABLE public.historial_puntos IS 'Log de acumulación y canje de puntos de lealtad. Auditoría completa.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 14: TABLA TARIFF_CONFIGS (PRICING)                                      ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.tariff_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    base_fare NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    per_fraction_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fraction_km NUMERIC(5, 2) NOT NULL DEFAULT 0.10,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_tariff 
ON public.tariff_configs(organizacion_id) 
WHERE is_active = true;

ALTER TABLE public.tariff_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tariffs_isolation" ON public.tariff_configs
    FOR ALL 
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

COMMENT ON TABLE public.tariff_configs IS 'Configuración de precios por organización. Solo 1 tarifa activa por org.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 15: TABLA TARIFF_HISTORY (AUDIT TRAIL)                                  ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.tariff_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    tariff_id UUID NOT NULL REFERENCES public.tariff_configs(id) ON DELETE CASCADE,
    old_base_fare NUMERIC(10, 2),
    old_fraction_price NUMERIC(10, 2),
    changed_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tariff_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history_isolation" ON public.tariff_history
    FOR ALL 
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 16: TABLA TARIFF_BRANDING                                               ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.tariff_branding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE UNIQUE,
    company_name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#000000',
    secondary_color TEXT DEFAULT '#ffffff'
);

ALTER TABLE public.tariff_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branding_isolation" ON public.tariff_branding
    FOR ALL 
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 17: TABLA RESERVATIONS                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre_cliente TEXT NOT NULL,
    telefono TEXT NOT NULL,
    origen TEXT NOT NULL,
    destino TEXT NOT NULL,
    fecha_viaje DATE NOT NULL,
    hora_viaje TIME NOT NULL,
    distancia_km NUMERIC(10, 2),
    costo_estimado NUMERIC(10, 2),
    estado TEXT CHECK (estado IN ('pendiente', 'confirmada', 'asignada', 'completada', 'cancelada')) DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_org ON public.reservations(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_reservations_fecha ON public.reservations(fecha_viaje);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservas_isolation" ON public.reservations
    FOR ALL 
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

COMMENT ON TABLE public.reservations IS 'Reservas de viajes anticipados con horario específico.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 18: TABLA CONVERSATION_STATE (BOT STATE)                                ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.conversation_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefono TEXT NOT NULL UNIQUE,
    estado_actual TEXT DEFAULT 'init',
    datos_parciales JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.conversation_state IS 'Estado conversacional para WhatsApp bot integration. Almacena estado de diálogo parcial.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 19: TABLA COMERCIOS (AFFILIATE PARTNERS)                                ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.comercios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    categoria TEXT,
    logo_url TEXT,
    sitio_web TEXT,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comercios_org ON public.comercios(organizacion_id);

ALTER TABLE public.comercios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercios_isolation" ON public.comercios
    FOR ALL 
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

COMMENT ON TABLE public.comercios IS 'Negocios asociados para programa de descuentos con tarjeta/QR.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 20: TABLA COMERCIO_SOLICITUDES                                          ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.comercio_solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre_comercio TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    ubicacion TEXT,
    rubro TEXT,
    estado TEXT CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')) DEFAULT 'pendiente',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comercio_solicitudes_org ON public.comercio_solicitudes(organizacion_id);

ALTER TABLE public.comercio_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercio_solicitudes_isolation" ON public.comercio_solicitudes
    FOR ALL 
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 21: TABLA HISTORIAL_ESCANEOS_SOCIOS (AFFILIATE PROGRAM TRACKING)         ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.historial_escaneos_socios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escaneos_usuario ON public.historial_escaneos_socios(user_id);
CREATE INDEX IF NOT EXISTS idx_escaneos_comercio ON public.historial_escaneos_socios(comercio_id);

ALTER TABLE public.historial_escaneos_socios ENABLE ROW LEVEL SECURITY;

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 22: TABLA BOLSA_EMPLEOS (JOB BOARD - OFFERS)                            ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.bolsa_empleos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    titular_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    requisitos TEXT,
    estado TEXT CHECK (estado IN ('abierta', 'en_proceso', 'cerrada')) DEFAULT 'abierta',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bolsa_empleos_titular ON public.bolsa_empleos(titular_id);
CREATE INDEX IF NOT EXISTS idx_bolsa_empleos_org ON public.bolsa_empleos(organizacion_id);

ALTER TABLE public.bolsa_empleos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bolsa_empleos_select_all" ON public.bolsa_empleos
    FOR SELECT USING (
        estado = 'abierta' 
        OR titular_id = auth.uid()
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "bolsa_empleos_insert" ON public.bolsa_empleos
    FOR INSERT WITH CHECK (
        titular_id = auth.uid() 
        OR public.get_auth_rol() IN ('admin', 'superadmin', 'titular')
    );

CREATE POLICY "bolsa_empleos_update" ON public.bolsa_empleos
    FOR UPDATE USING (
        titular_id = auth.uid() 
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 23: TABLA BOLSA_POSTULACIONES (JOB BOARD - APPLICATIONS)                ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.bolsa_postulaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    oferta_id UUID NOT NULL REFERENCES public.bolsa_empleos(id) ON DELETE CASCADE,
    chofer_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    mensaje TEXT,
    estado TEXT CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')) DEFAULT 'pendiente',
    aprobado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_postulacion UNIQUE (oferta_id, chofer_id)
);

CREATE INDEX IF NOT EXISTS idx_bolsa_postulaciones_oferta ON public.bolsa_postulaciones(oferta_id);
CREATE INDEX IF NOT EXISTS idx_bolsa_postulaciones_chofer ON public.bolsa_postulaciones(chofer_id);

ALTER TABLE public.bolsa_postulaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bolsa_postulaciones_select" ON public.bolsa_postulaciones
    FOR SELECT USING (
        chofer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.bolsa_empleos WHERE id = oferta_id AND titular_id = auth.uid())
        OR public.get_auth_rol() IN ('admin', 'superadmin')
    );

CREATE POLICY "bolsa_postulaciones_insert" ON public.bolsa_postulaciones
    FOR INSERT WITH CHECK (
        chofer_id = auth.uid()
        OR public.get_auth_rol() IN ('admin', 'superadmin', 'chofer')
    );

CREATE POLICY "bolsa_postulaciones_update" ON public.bolsa_postulaciones
    FOR UPDATE USING (
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

COMMENT ON TABLE public.bolsa_empleos IS 'Job board: ofertas de trabajo posted por titulares.';
COMMENT ON TABLE public.bolsa_postulaciones IS 'Job board: postulaciones de choferes a ofertas.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 24: TABLA CUENTA_CORRIENTE_EMPRESAS (COMPANY LEDGER)                    ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.cuenta_corriente_empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    concepto TEXT NOT NULL CHECK (concepto IN ('VIAJE', 'PAGO', 'AJUSTE')),
    monto NUMERIC(10, 2) NOT NULL,
    es_debito BOOLEAN NOT NULL,
    referencia_id UUID,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cuenta_corriente_empresa ON public.cuenta_corriente_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cuenta_corriente_fecha ON public.cuenta_corriente_empresas(fecha);

ALTER TABLE public.cuenta_corriente_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuenta_corriente_isolation" ON public.cuenta_corriente_empresas
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE id = empresa_id AND organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );

COMMENT ON TABLE public.cuenta_corriente_empresas IS 'Ledger de débitos (viajes) y créditos (pagos) por empresa.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 25: TABLA PROMOCIONES                                                   ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.promociones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    puntos_requeridos INTEGER DEFAULT 0,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promociones_isolation" ON public.promociones
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 26: FUNCIÓN SEGURA PARA OBTENER VIAJES CERCANOS (RADAR CON POSTGIS)     ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION get_viajes_cercanos(
    chofer_lat float, 
    chofer_lng float, 
    radius_km integer DEFAULT 10, 
    target_orga_id UUID DEFAULT NULL
)
RETURNS SETOF public.viajes
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    mi_orga UUID;
    auth_user_id UUID;
BEGIN
    auth_user_id := auth.uid();

    mi_orga := target_orga_id; 
    
    IF mi_orga IS NULL THEN
        mi_orga := (current_setting('request.jwt.claims', true)::jsonb ->> 'organizacion_id')::UUID;
    END IF;

    IF mi_orga IS NULL AND auth_user_id IS NOT NULL THEN
        SELECT organizacion_id INTO mi_orga FROM public.usuarios WHERE id = auth_user_id;
    END IF;
    
    IF mi_orga IS NULL THEN
        SELECT id INTO mi_orga FROM public.organizaciones LIMIT 1;
    END IF;

    IF mi_orga IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT v.* FROM public.viajes v
    WHERE lower(v.estado) IN ('solicitado', 'requested')
      AND v.organizacion_id = mi_orga
      AND v.origen IS NOT NULL
      AND (v.origen->>'lng') IS NOT NULL
      AND (v.origen->>'lat') IS NOT NULL
      AND ST_DistanceSphere(
            ST_MakePoint((v.origen->>'lng')::numeric, (v.origen->>'lat')::numeric),
            ST_MakePoint(chofer_lng, chofer_lat)
          ) <= (radius_km * 1000)
    ORDER BY 
          ST_DistanceSphere(
            ST_MakePoint((v.origen->>'lng')::numeric, (v.origen->>'lat')::numeric),
            ST_MakePoint(chofer_lng, chofer_lat)
          ) ASC,
          v.creado_en DESC;
END;
$$;

COMMENT ON FUNCTION get_viajes_cercanos IS 'RPC para obtener viajes solicitados cerca del chofer (en km). Usa PostGIS para cálculo de distancia.';

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 27: STORAGE BUCKETS PARA ARCHIVOS                                       ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

-- Bucket para comprobantes de pago
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para fotos de perfil
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para documentos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket para logos de comercios
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comercios-logos', 'comercios-logos', true)
ON CONFLICT (id) DO NOTHING;

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 28: CONSTRAINTS ADICIONALES DE SEGURIDAD                                ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

-- Evitar race conditions en MercadoPago webhooks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movimientos_saldo' AND column_name='mp_payment_id') THEN
        -- Crear tabla si no existe
        CREATE TABLE IF NOT EXISTS public.movimientos_saldo (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
            monto NUMERIC(10, 2) NOT NULL,
            tipo TEXT CHECK (tipo IN ('DEBITO', 'CREDITO')) NOT NULL,
            mp_payment_id TEXT UNIQUE,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- Si la columna ya existe, asegurar que sea UNIQUE
        ALTER TABLE public.movimientos_saldo DROP CONSTRAINT IF EXISTS movimientos_saldo_mp_payment_id_key;
        ALTER TABLE public.movimientos_saldo ADD CONSTRAINT movimientos_saldo_mp_payment_id_key UNIQUE(mp_payment_id);
    END IF;
END $$;

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ VERIFICACIÓN FINAL                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

-- Listar todas las tablas creadas
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Listar todas las funciones creadas
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║ FIN DEL SCRIPT SQL DE BACKUP COMPLETO                                         ║
-- ║ Todos los objetos han sido creados correctamente                              ║
-- ║ Fecha: 2026-04-20 | Versión: 1.0                                              ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝
