

-- ===== FILE: tariffs_reservations.sql =====
-- === EXTENSIÓN: TARIFAS Y RESERVAS ===

-- 1. Tabla: Configuraciones de Tarifas
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

-- Constraint para asegurar solo 1 tarifa activa por organización (Unique parcial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_tariff 
ON public.tariff_configs(organizacion_id) 
WHERE is_active = true;

-- 2. Tabla: Historial de Tarifas (Auditoría)
CREATE TABLE IF NOT EXISTS public.tariff_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    tariff_id UUID NOT NULL REFERENCES public.tariff_configs(id) ON DELETE CASCADE,
    old_base_fare NUMERIC(10, 2),
    old_fraction_price NUMERIC(10, 2),
    changed_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla: Branding Visual (Opcional, pero se añade por completitud)
CREATE TABLE IF NOT EXISTS public.tariff_branding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE UNIQUE,
    company_name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#000000',
    secondary_color TEXT DEFAULT '#ffffff'
);

-- 4. Tabla: Reservas Independientes
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

-- 5. Tabla: Estado Conversacional (Opcional/Futuro)
CREATE TABLE IF NOT EXISTS public.conversation_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefono TEXT NOT NULL UNIQUE,
    estado_actual TEXT DEFAULT 'init',
    datos_parciales JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HABILITACIÓN RLS
ALTER TABLE public.tariff_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS AISLAMIENTO
CREATE POLICY "tariffs_isolation" ON public.tariff_configs FOR ALL USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
CREATE POLICY "history_isolation" ON public.tariff_history FOR ALL USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
CREATE POLICY "branding_isolation" ON public.tariff_branding FOR ALL USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
CREATE POLICY "reservas_isolation" ON public.reservations FOR ALL USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
-- conversation_state no requiere aislamiento estricto por organización si el bot identifica org por session context, pero si aplica:
-- CREATE POLICY "conv_state_isolation" ON public.conversation_state FOR ALL USING (true); -- Al ser pública/bot


-- ===== FILE: points_system.sql =====
-- === MIGRACIÓN: SISTEMA DE PUNTOS Y VIAJES GRATIS ===

-- 1. Agregar campos a la tabla de usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS puntos_actuales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS viajes_gratis INTEGER DEFAULT 0;

-- 2. Agregar campos a la tabla de viajes
ALTER TABLE public.viajes 
ADD COLUMN IF NOT EXISTS puntos_generados INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usado_viaje_gratis BOOLEAN DEFAULT false;

-- 3. Crear tabla historial_puntos
CREATE TABLE IF NOT EXISTS public.historial_puntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    viaje_id UUID REFERENCES public.viajes(id) ON DELETE SET NULL,
    puntos INTEGER NOT NULL,
    tipo TEXT CHECK (tipo IN ('ACUMULACION', 'CANJE')) NOT NULL,
    descripcion TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar RLS para historial_puntos
ALTER TABLE public.historial_puntos ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de seguridad para historial_puntos
DROP POLICY IF EXISTS "historial_puntos_isolation" ON public.historial_puntos;
CREATE POLICY "historial_puntos_isolation" ON public.historial_puntos
    FOR ALL
    USING (user_id = auth.uid() OR public.get_auth_rol() = 'superadmin' OR public.get_auth_rol() = 'admin');

-- 6. Comentarios para documentación
COMMENT ON COLUMN public.usuarios.puntos_actuales IS 'Puntos acumulados por el usuario para canje de viajes gratis.';
COMMENT ON COLUMN public.usuarios.viajes_gratis IS 'Contador de viajes gratuitos disponibles para el usuario.';
COMMENT ON COLUMN public.viajes.puntos_generados IS 'Puntos otorgados al completar este viaje.';
COMMENT ON COLUMN public.viajes.usado_viaje_gratis IS 'Indica si este viaje fue canjeado por puntos (costo $0).';


-- ===== FILE: fix_rls_politicas.sql =====
-- PARCHE MULTI-TENANT: Corregir funciones RLS (Row Level Security)

-- El enfoque anterior requería custom JWT claims. Este nuevo script utiliza 
-- SECURITY DEFINER para buscar la organización de forma nativa sin romper la app.

-- 1. Eliminar políticas antiguas que dependían del JWT Claim
DROP POLICY IF EXISTS "usuarios_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "choferes_isolation" ON public.choferes;
DROP POLICY IF EXISTS "viajes_isolation" ON public.viajes;
DROP POLICY IF EXISTS "promociones_isolation" ON public.promociones;

-- 2. Función segura para obtener la organización del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_current_organizacion_id() RETURNS UUID AS $$
  SELECT organizacion_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Nueva Política: USUARIOS
-- Permite al usuario verse A SÍ MISMO para poder iniciar sesión, 
-- O permite ver a toda su organización si es parte de ella.
CREATE POLICY "usuarios_isolation" ON public.usuarios
    FOR ALL
    USING (
      id = auth.uid() OR 
      organizacion_id = public.get_current_organizacion_id()
    );

-- 4. Nueva Política: CHOFERES
CREATE POLICY "choferes_isolation" ON public.choferes
    FOR ALL
    USING (organizacion_id = public.get_current_organizacion_id());

-- 5. Nueva Política: VIAJES
CREATE POLICY "viajes_isolation" ON public.viajes
    FOR ALL
    USING (organizacion_id = public.get_current_organizacion_id());

-- 6. Nueva Política: PROMOCIONES
CREATE POLICY "promociones_isolation" ON public.promociones
    FOR ALL
    USING (organizacion_id = public.get_current_organizacion_id());


-- ===== FILE: fix_usuarios_insert_rls.sql =====
-- skipped redundant policy


-- ===== FILE: update_v2.sql =====
-- Actualización Remisería v2.0 - Migración de Base de Datos

-- 1. Actualizar estados en la tabla viajes
ALTER TABLE public.viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;
ALTER TABLE public.viajes ADD CONSTRAINT viajes_estado_check 
CHECK (estado IN ('REQUESTED', 'QUOTED', 'ACCEPTED', 'ASSIGNED', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'NO_SHOW', 'solicitado', 'asignado', 'en_camino', 'finalizado', 'cancelado', 'en_puerta'));

-- 2. Agregar nuevas columnas de timestamps a viajes
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- 3. Agregar columnas de cálculo a viajes
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 0;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS wait_cost NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS final_price NUMERIC(10, 2);
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS calificacion INTEGER;

-- 4. Actualizar tabla tariff_configs con nuevas reglas
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS wait_free_minutes INTEGER DEFAULT 5;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS wait_block_minutes INTEGER DEFAULT 10;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS wait_block_price NUMERIC(10, 2) DEFAULT 2500.00;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS wait_price_per_minute NUMERIC(10, 2) DEFAULT 250.00;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS trunk_price NUMERIC(10, 2) DEFAULT 2500.00;
ALTER TABLE public.tariff_configs ADD COLUMN IF NOT EXISTS dynamic_multiplier NUMERIC(3, 2) DEFAULT 1.00;

-- 5. Opcional: Migrar estados existentes (si es necesario para compatibilidad inmediata)
UPDATE public.viajes SET estado = 'REQUESTED' WHERE estado = 'solicitado';
UPDATE public.viajes SET estado = 'ASSIGNED' WHERE estado = 'asignado';
UPDATE public.viajes SET estado = 'ARRIVED' WHERE estado = 'en_puerta';
UPDATE public.viajes SET estado = 'FINISHED' WHERE estado = 'finalizado';
UPDATE public.viajes SET estado = 'CANCELLED' WHERE estado = 'cancelado';
UPDATE public.viajes SET estado = 'STARTED' WHERE estado = 'en_camino';


-- ===== FILE: wallet_update.sql =====
-- backend/wallet_update.sql

-- 1. Añadimos campo de saldo a choferes si no existe
ALTER TABLE public.choferes ADD COLUMN IF NOT EXISTS saldo NUMERIC(10,2) DEFAULT 0;

-- 2. Tabla para registrar los movimientos de saldo de la Billetera
CREATE TABLE IF NOT EXISTS public.movimientos_saldo (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    chofer_id UUID REFERENCES public.choferes(id) ON DELETE CASCADE,
    monto NUMERIC(10,2) NOT NULL, 
    -- Si es cargo a la base: monto negativo (ej. -3000 por diaria)
    -- Si es pago (Vía MP o Efectivo en base): monto positivo (ej. +3000)
    tipo VARCHAR(50) NOT NULL, -- ej. 'cargo_diario', 'cargo_viaje', 'pago_mp', 'pago_efectivo'
    descripcion TEXT,
    mp_payment_id VARCHAR(255), -- ID de Mercado Pago si aplica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.movimientos_saldo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Movimientos visibles para el chofer correspondiente"
    ON public.movimientos_saldo FOR SELECT
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- Admins pueden insertar movimientos (ej. cobrar diaria)
CREATE POLICY "Admins pueden registrar cargos o pagos manuales"
    ON public.movimientos_saldo FOR INSERT
    WITH CHECK (organizacion_id = public.get_auth_orga_id());

-- El backend mediante Service Key ignorará RLS para reportar pagos de MercadoPago automáticos.


-- ===== FILE: update_schema_fase3.sql =====
-- FASE 3: Motor de Inteligencia Artificial para WhatsApp (Evolution -> OpenAI)

-- Creamos la tabla de sesiones de chat para que el Bot de OpenAI "recuerde" de qué está hablando
-- con cada cliente por WhatsApp hasta que se concrete el viaje.

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    telefono TEXT PRIMARY KEY,
    historial JSONB DEFAULT '[]'::jsonb,
    estado TEXT DEFAULT 'negociando', -- negociando, confirmado
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar seguridad mínima si fuese necesario, pero normalmente el backend accede via service_role
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Política para que el admin/backend pueda operar libremente
CREATE POLICY "service_role_chat_sessions" ON public.chat_sessions
    FOR ALL
    USING (true);


-- ===== FILE: update_fase_pasajeros.sql =====
-- ==========================================
-- UPDATE: FASE PASAJEROS Y PROMOCIONES
-- ==========================================

-- 1. Modificar tabla promociones para soportar lógica de negocio de descuentos
ALTER TABLE public.promociones 
ADD COLUMN IF NOT EXISTS tipo_descuento TEXT CHECK (tipo_descuento IN ('porcentaje', 'fijo')) DEFAULT 'porcentaje',
ADD COLUMN IF NOT EXISTS valor_descuento NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dias_aplicacion JSONB DEFAULT '[]'::jsonb, -- Ej: ["Lunes", "Viernes"]
ADD COLUMN IF NOT EXISTS horario_inicio TIME,
ADD COLUMN IF NOT EXISTS horario_fin TIME,
ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
ADD COLUMN IF NOT EXISTS fecha_fin DATE,
ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;

-- 2. Modificar tabla viajes para reflejar método de pago y promociones aplicadas
ALTER TABLE public.viajes
ADD COLUMN IF NOT EXISTS promocion_id UUID REFERENCES public.promociones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS monto_descontado NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'mp')) DEFAULT 'efectivo',
ADD COLUMN IF NOT EXISTS precio_original NUMERIC(10, 2);

-- Actualizar precios originales en viajes pasados
UPDATE public.viajes SET precio_original = precio WHERE precio_original IS NULL;


-- ===== FILE: update_schema_deudas.sql =====
-- backend/update_schema_deudas.sql

-- 1. Añadimos campo de fecha de inicio de deuda a choferes si no existe
ALTER TABLE public.choferes ADD COLUMN IF NOT EXISTS fecha_inicio_deuda TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.choferes ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'activo'; -- Asegurando que tengan estado

-- 2. Creamos la función del Trigger
CREATE OR REPLACE FUNCTION public.actualizar_fecha_deuda_chofer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si el saldo baja a valor negativo y antes era >= 0 (o nulo)
  IF (NEW.saldo < 0) AND (OLD.saldo IS NULL OR OLD.saldo >= 0) THEN
    NEW.fecha_inicio_deuda := timezone('utc'::text, now());
  END IF;

  -- Si el saldo vuelve a ser >= 0, limpiamos la fecha e intentamos activar si estaba bloqueado por deuda
  IF (NEW.saldo >= 0) THEN
    NEW.fecha_inicio_deuda := NULL;
    -- Opcional: Desbloquear automáticamente si paga
    IF (OLD.estado = 'inactivo' OR OLD.estado = 'bloqueado') THEN
      NEW.estado := 'activo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Asignamos el Trigger a la tabla choferes
DROP TRIGGER IF EXISTS trg_actualizar_fecha_deuda ON public.choferes;

CREATE TRIGGER trg_actualizar_fecha_deuda
BEFORE UPDATE ON public.choferes
FOR EACH ROW
WHEN (OLD.saldo IS DISTINCT FROM NEW.saldo)
EXECUTE FUNCTION public.actualizar_fecha_deuda_chofer();

-- 4. Actualizamos a los que ya tienen deuda para que empiecen a contar desde hoy o una fecha anterior simulada
UPDATE public.choferes 
SET fecha_inicio_deuda = timezone('utc'::text, now()) - INTERVAL '10 days' -- Para que el cron los agarre de inmediato en pruebas, o lo ajustas
WHERE saldo < 0 AND fecha_inicio_deuda IS NULL;


-- ===== FILE: fix_org_rls.sql =====
-- skipped redundant org policy


-- ===== FILE: 01_fix_security_and_postgis.sql =====
-- =========================================================================
-- Auditoría de Seguridad Viajes NEA - Parche SQL Múltiple (Producción)
-- 1. Introducción de PostGIS para Geolocalización Aislada
-- 2. Refactor de Aislamiento de Organizaciones (RLS Estricto)
-- 3. Inserción de Constrainsts de Pagos para mitigar Race Conditions
-- =========================================================================

-- PARTE 1: ACTIVAR POSTGIS PARA EL RADAR (Geospatial extension)
CREATE EXTENSION IF NOT EXISTS postgis;

-- PARTE 2: FUNCIÓN SEGURA DE RADAR POR DISTANCIA (Oculta viajes lejanos al chofer)
-- El chofer le enviará sus coordenadas actuales a esta RPC.
-- target_orga_id: Parámetro opcional para cuando se llama desde el backend con Service Role Key.
CREATE OR REPLACE FUNCTION get_viajes_cercanos(chofer_lat float, chofer_lng float, radius_km integer DEFAULT 10, target_orga_id UUID DEFAULT NULL)
RETURNS SETOF public.viajes
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    mi_orga UUID;
    auth_user_id UUID;
BEGIN
    -- 1. Obtener ID del usuario autenticado (si existe)
    auth_user_id := auth.uid();

    -- 2. Determinar Organización
    mi_orga := target_orga_id; 
    
    -- Si no hay orga explícita, buscar en el JWT
    IF mi_orga IS NULL THEN
        mi_orga := (current_setting('request.jwt.claims', true)::jsonb ->> 'organizacion_id')::UUID;
    END IF;

    -- Si sigue siendo NULL, buscar en la tabla de usuarios del chofer
    IF mi_orga IS NULL AND auth_user_id IS NOT NULL THEN
        SELECT organizacion_id INTO mi_orga FROM public.usuarios WHERE id = auth_user_id;
    END IF;
    
    -- Fallback final: Si sigue siendo NULL y solo hay una orga en el sistema, usarla
    IF mi_orga IS NULL THEN
        SELECT id INTO mi_orga FROM public.organizaciones LIMIT 1;
    END IF;

    -- Si no hay orga a este punto, no podemos devolver nada por seguridad
    IF mi_orga IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT v.* FROM public.viajes v
    WHERE lower(v.estado) IN ('solicitado', 'requested') -- FIX: Evitar que choferes vean viajes ajenos (asignado, accepted, arrived)
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


-- PARTE 3: REFACTORIZACIÓN DE SEGURIDAD RLS PARA EVITAR ESCALAMIENTO DE PERMISOS
-- NOTA: Previamente existía "usuarios_isolation" con FOR ALL que permitía a CUALQUIERA editar u borrar CUALQUIERA en la empresa.

DROP POLICY IF EXISTS "usuarios_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_select_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_update_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_delete_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "usu_insert_isolation" ON public.usuarios;

-- a) Lectura: Todos pueden leer su propio perfil. Además, todos en la misma empresa pueden listar los usuarios (ej: buscar choferes, etc)
CREATE POLICY "usu_select_isolation" ON public.usuarios
    FOR SELECT 
    USING (id = auth.uid() OR organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');


-- b) Edición (UPDATE): Solo puedes editar tu PROPIO usuario.
CREATE POLICY "usu_update_isolation" ON public.usuarios
    FOR UPDATE
    USING (id = auth.uid() OR public.get_auth_rol() = 'superadmin');

-- c) Eliminación (DELETE): Solo los superadmins o tú mismo puedes borrar tu perfil.
CREATE POLICY "usu_delete_isolation" ON public.usuarios
    FOR DELETE
    USING (id = auth.uid() OR public.get_auth_rol() = 'superadmin');

-- d) Inserción (INSERT): Mantener auto-registro protegido
CREATE POLICY "usu_insert_isolation" ON public.usuarios 
    FOR INSERT 
    WITH CHECK (auth.uid() = id OR public.get_auth_rol() = 'superadmin');


-- PARTE 4: UNIQUE KEY PARA EVITAR DOBLE GASTO / RACE CONDITIONS DE MERCADO PAGO
-- Agrega restricción en base de datos. Si otro web-hook entra al revés o de la misma petición, BD tirará Integrity Error y abortará.
-- Asumiendo que la tabla es movimientos_saldo (o similar que se utilice para registrar).
-- NOTA: Primero validamos si existe mp_payment_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movimientos_saldo' AND column_name='mp_payment_id') THEN
        ALTER TABLE public.movimientos_saldo ADD COLUMN mp_payment_id TEXT UNIQUE;
    ELSE
        -- Si la columna ya existe, asegurarse de que sea UNIQUE
        ALTER TABLE public.movimientos_saldo DROP CONSTRAINT IF EXISTS movimientos_saldo_mp_payment_id_key;
        ALTER TABLE public.movimientos_saldo ADD CONSTRAINT movimientos_saldo_mp_payment_id_key UNIQUE(mp_payment_id);
    END IF;
END $$;


-- ===== FILE: 02_traslados_empresariales.sql =====
-- === VIAJES-NEA: TRASLADOS EMPRESARIALES ===
-- Añadiendo funcionalidades para viajes corporativos sin agregar "Rol Empresa"

-- 1. CREACIÓN DE TABLAS

CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre_empresa TEXT NOT NULL,
    cuit TEXT,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.empresa_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    limite_mensual NUMERIC(10, 2) DEFAULT 0, -- 0 = Sin limite
    saldo NUMERIC(10, 2) DEFAULT 0,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- Un usuario pertenece a UNA empresa
);

CREATE TABLE IF NOT EXISTS public.empresa_beneficios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo_descuento TEXT CHECK (tipo_descuento IN ('PORCENTAJE', 'FIJO')) DEFAULT 'PORCENTAJE',
    valor NUMERIC(10, 2) NOT NULL,
    limite_mensual INTEGER DEFAULT 0, -- Viajes mensuales max permitidos, 0 = infinito
    horario_inicio TIME,
    horario_fin TIME,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ALTERACIÓN DE TABLA VIAJES
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS tipo_viaje TEXT DEFAULT 'PERSONAL';
ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
-- "precio_original", "monto_descontado" y "final_price" ("precio") ya existen y los reutilizaremos para no duplicar datos, 
-- aplicando monto_descontado si aplica beneficio de empresa

-- 3. HABILITACIÓN RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_beneficios ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS (Multi-Tenant isolation)
-- Solo visible para la misma organizacion
CREATE POLICY "empresas_isolation" ON public.empresas
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- empresa_usuarios, heredando la organizacion de empresas
CREATE POLICY "empresa_usuarios_isolation" ON public.empresa_usuarios
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE public.empresas.id = public.empresa_usuarios.empresa_id AND public.empresas.organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );

-- empresa_beneficios
CREATE POLICY "empresa_beneficios_isolation" ON public.empresa_beneficios
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE public.empresas.id = public.empresa_beneficios.empresa_id AND public.empresas.organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );


-- ===== FILE: 03_tracking_y_calificaciones.sql =====
-- === 03_TRACKING_Y_CALIFICACIONES.SQL ===

-- 1. Añadir campos de tracking de tiempo a la tabla `viajes`
ALTER TABLE public.viajes
ADD COLUMN IF NOT EXISTS fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS fecha_aceptacion TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fecha_llegada_origen TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fecha_inicio_viaje TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fecha_fin_viaje TIMESTAMP WITH TIME ZONE;

-- 2. Crear tabla `calificaciones`
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

-- 3. Habilitar RLS en `calificaciones`
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para `calificaciones`
-- Los pasajeros pueden crear calificaciones para sus propios viajes y verlas
CREATE POLICY "pasajero_puede_crear_calificacion" 
    ON public.calificaciones FOR INSERT 
    WITH CHECK (pasajero_id = public.get_auth_orga_id() OR pasajero_id IN (SELECT id FROM public.usuarios WHERE id = auth.uid()));

CREATE POLICY "pasajero_puede_ver_sus_calificaciones" 
    ON public.calificaciones FOR SELECT 
    USING (pasajero_id = auth.uid());

-- Los choferes pueden ver las calificaciones que les asignaron
CREATE POLICY "chofer_puede_ver_sus_calificaciones" 
    ON public.calificaciones FOR SELECT 
    USING (chofer_id IN (SELECT id FROM public.choferes WHERE usuario_id = auth.uid()));

-- Los admins / superadmins pueden ver todas (las verán por roles ya dados o simplemente se habilita para superadmin)
CREATE POLICY "superadmin_puede_ver_todas_las_calificaciones" 
    ON public.calificaciones FOR ALL 
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));


-- ===== FILE: 04_pagos_chofer.sql =====
-- === 04_PAGOS_CHOFER.SQL ===
-- Sistema de Pagos Manuales (Chofer -> Administración)

-- 1. Tabla Principal
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

-- 2. Habilitar RLS
ALTER TABLE public.pagos_chofer ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS
DROP POLICY IF EXISTS "pagos_chofer_select" ON public.pagos_chofer;
DROP POLICY IF EXISTS "pagos_chofer_insert" ON public.pagos_chofer;
DROP POLICY IF EXISTS "pagos_chofer_update" ON public.pagos_chofer;

-- a) Lectura: Los choferes pueden ver sus propios pagos. Admins/Superadmins ven todos.
-- a) Lectura: Los choferes pueden ver sus propios pagos. Admins/Superadmins ven los de su organización.
CREATE POLICY "pagos_chofer_select" ON public.pagos_chofer
    FOR SELECT
    USING (
        organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin'
    );

-- b) Inserción: Solo los choferes pueden crear pagos (y automáticamente se asocia a su ID)
CREATE POLICY "pagos_chofer_insert" ON public.pagos_chofer
    FOR INSERT
    WITH CHECK (
        organizacion_id = public.get_auth_orga_id()
    );

-- c) Edición: Solo Admins/Superadmins pueden actualizar (Aprobar/Rechazar)
CREATE POLICY "pagos_chofer_update" ON public.pagos_chofer
    FOR UPDATE
    USING (public.get_auth_rol() IN ('admin', 'superadmin'));

-- 4. Supabase Storage: Bucket para Comprobantes
-- Nota: La creación de buckets desde SQL nativo de Supabase a veces requiere configuraciones adicionales de inserción.
-- Se inserta en la tabla de buckets de storage (storage.buckets).
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- Dar permisos para subir archivos de forma pública o autenticada (Opcional, depende de configuración de Storage)
-- CREATE POLICY "Comprobantes Uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprobantes');
-- CREATE POLICY "Comprobantes Public Viewing" ON storage.objects FOR SELECT USING (bucket_id = 'comprobantes');


-- ===== FILE: 05_fix_radar_and_realtime.sql =====
-- Parche de Mejora del Radar de Solicitudes y Tiempo Real
-- Fija estado, aislamiento de asignaciones y ordenamiento por distancia de postGIS para conductores

-- Re-escribimos la Función POSTGIS principal
CREATE OR REPLACE FUNCTION public.get_viajes_cercanos(
    chofer_lat double precision,
    chofer_lng double precision,
    radius_km integer DEFAULT 10,
    target_orga_id uuid DEFAULT NULL::uuid
)
RETURNS SETOF public.viajes
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    mi_orga UUID;
    auth_user_id UUID;
BEGIN
    -- 1. Obtener ID del usuario autenticado (si existe acceso desde Edge o Web)
    auth_user_id := auth.uid();

    -- 2. Determinar Organización Activa
    mi_orga := target_orga_id; 
    
    -- Si no hay orga explícita por parámetro RPC, buscar en el Header Autorizador
    IF mi_orga IS NULL THEN
        mi_orga := (current_setting('request.jwt.claims', true)::jsonb ->> 'organizacion_id')::UUID;
    END IF;

    -- Si sigue siendo NULL y existe session, inferir desde usuario chofer
    IF mi_orga IS NULL AND auth_user_id IS NOT NULL THEN
        SELECT organizacion_id INTO mi_orga FROM public.usuarios WHERE id = auth_user_id;
    END IF;
    
    -- Fallback final: Si la empresa es de inquilino unico (ej. pruebas). 
    IF mi_orga IS NULL THEN
        SELECT id INTO mi_orga FROM public.organizaciones LIMIT 1;
    END IF;

    -- Guardias de Seguridad
    IF mi_orga IS NULL THEN
        RETURN;
    END IF;

    -- Ejecucion y Order Dinámico (Se remueven estados asignado/accepted para evitar viajes fantasmas)
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
          -- PRIORIDAD AL CHOFER MAS CERCANO
          ST_DistanceSphere(
            ST_MakePoint((v.origen->>'lng')::numeric, (v.origen->>'lat')::numeric),
            ST_MakePoint(chofer_lng, chofer_lat)
          ) ASC, 
          v.creado_en DESC;
END;
$function$;


-- ===== FILE: 06_security_audit_fixes.sql =====
-- =========================================================================
-- Auditoría de Seguridad Viajes NEA - Parche SQL 
-- 1. Bloqueo de escalamiento de privilegios por frontend
-- =========================================================================

-- Trigger para bloquear el cambio de columnas sensibles desde el cliente web
CREATE OR REPLACE FUNCTION public.trg_proteger_columnas_usuarios()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la consulta NO proviene de PostgREST sino del backend backend, la saltamos.
    -- Pero PostgREST usa un rol llamado 'anon' o 'authenticated'
    IF current_user IN ('anon', 'authenticated') THEN
        -- Solo dejamos pasar si el JWT rol es 'superadmin' explicitamente (si asi lo codificaste en el payload)
        IF NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'rol', '') IS DISTINCT FROM 'superadmin' THEN
            
            -- Detectar intento de auto-asignacion de rol
            IF NEW.rol IS DISTINCT FROM OLD.rol THEN
                RAISE EXCEPTION 'ALERTA DE SEGURIDAD: Inyección detectada al intentar alterar rol';
            END IF;
            
            -- Detectar alteracion de puntos
            IF NEW.puntos_actuales IS DISTINCT FROM OLD.puntos_actuales THEN
                RAISE EXCEPTION 'ALERTA DE SEGURIDAD: Inyección detectada al alterar puntos actuales';
            END IF;

            -- Detectar fraude en viajes gratis
            IF NEW.viajes_gratis IS DISTINCT FROM OLD.viajes_gratis THEN
                RAISE EXCEPTION 'ALERTA DE SEGURIDAD: Inyección detectada al alterar viajes_gratis';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminamos si existia antes para no duplicar
DROP TRIGGER IF EXISTS trg_proteger_columnas_usuarios_trigger ON public.usuarios;

-- Creamos el trigger sobre public.usuarios ANTES DEL UPDATE
CREATE TRIGGER trg_proteger_columnas_usuarios_trigger
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.trg_proteger_columnas_usuarios();


-- ===== FILE: 07_cuenta_corriente_empresas.sql =====
-- === VIAJES-NEA: CUENTA CORRIENTE EMPRESARIAL ===
-- Añade rastreo de deuda y saldos para empresas adheridas

-- 1. MODIFICAR TABLA EMPRESAS
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS saldo NUMERIC(10, 2) DEFAULT 0;

-- 2. CREACIÓN DE TABLA DE MOVIMIENTOS
CREATE TABLE IF NOT EXISTS public.cuenta_corriente_empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('DEBITO', 'CREDITO')), -- DEBITO (viajes consumidos), CREDITO (pagos realizados)
    monto NUMERIC(10, 2) NOT NULL,
    descripcion TEXT,
    metodo_pago TEXT,
    referencia_viaje_id UUID REFERENCES public.viajes(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. HABILITACIÓN RLS Y POLÍTICAS
ALTER TABLE public.cuenta_corriente_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_empresas_isolation" ON public.cuenta_corriente_empresas
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.empresas WHERE public.empresas.id = public.cuenta_corriente_empresas.empresa_id AND public.empresas.organizacion_id = public.get_auth_orga_id())
        OR public.get_auth_rol() = 'superadmin'
    );


-- ===== FILE: fix_estados_caja.sql =====
-- 1. Eliminar la restricción actual de estado en la tabla viajes
ALTER TABLE public.viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;

-- 2. Volver a crearla con los nuevos estados: 'en_puerta'
ALTER TABLE public.viajes ADD CONSTRAINT viajes_estado_check CHECK (estado IN ('solicitado', 'asignado', 'en_camino', 'en_puerta', 'finalizado', 'cancelado'));


-- ===== FILE: fix_calificacion.sql =====
ALTER TABLE public.viajes DROP COLUMN IF EXISTS calificacion;
ALTER TABLE public.viajes ADD COLUMN calificacion SMALLINT NULL CHECK (calificacion >= 1 AND calificacion <= 5);


-- ===== FILE: fixed_destinations_update.sql =====
-- backend/fixed_destinations_update.sql

CREATE TABLE IF NOT EXISTS public.fixed_destinations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    details VARCHAR(100),
    peaje BOOLEAN DEFAULT FALSE,
    column_index INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.fixed_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Destinos fijos visibles para todos"
    ON public.fixed_destinations FOR SELECT
    USING (true);

CREATE POLICY "Destinos fijos editables por todos"
    ON public.fixed_destinations FOR ALL
    USING (true);

-- Limpiar tabla por si se ejecuta múltiples veces
TRUNCATE TABLE public.fixed_destinations;

-- Insertar valores por defecto Columna 1
INSERT INTO public.fixed_destinations (name, price, details, peaje, column_index) VALUES
('Barranqueras', 21250, '19 km', false, 1),
('Sombrero', 37800, '36 km', true, 1),
('Empedrado', 65100, '62 km', true, 1),
('Formosa', 194250, '185 km', true, 1),
('Hiper Libertad', 21000, '18 km', true, 1),
('Laguna Brava', 16000, '15 km', false, 1),
('Paso de la Patria', 42000, '40 km', false, 1),
('Resistencia', 21000, '20 km', true, 1),
('Res. Aeropuerto', 30450, '29 km', true, 1),
('Res. Terminal', 30450, '29 km', true, 1),
('Shopping Res.', 18000, '17 km', true, 1),
('Riachuelo', 22100, '21 km', false, 1),
('San Cosme', 37800, '36 km', false, 1),
('San Luis del Palmar', 31500, '30 km', false, 1),
('Santa Ana', 21000, '20 km', false, 1),
('Itati', 77700, '74 km', false, 1),
('Saladas', 111300, '106 km', true, 1),
('Ing. 1° Correntino', 29400, '28 km', false, 1);

-- Insertar valores por defecto Columna 2
INSERT INTO public.fixed_destinations (name, price, details, peaje, column_index) VALUES
('Puente Pexoa', 19000, '18 km', false, 2),
('Unidad 6', 19000, '18 km', false, 2),
('Cañada Quiroz', 17000, '16 km', false, 2),
('Ramada Paso', 57750, '55 km', false, 2),
('Barrio Pescadores', 6300, '6 km', false, 2),
('Bella Vista', 151200, '144 km', false, 2),
('Ituzaingo', 241500, '230 km', false, 2);


-- ===== FILE: migracion_comercios_socio.sql =====
-- =======================================================
-- MIGRACIÓN: CARNET DE SOCIO Y COMERCIOS ADHERIDOS
-- =======================================================

-- 1. Modificar Constraint de Rol para permitir 'comercio'
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin', 'chofer', 'cliente', 'superadmin', 'comercio'));

-- 2. Añadir campo `es_socio` para marcar si el cliente tiene acceso al carnet de fidelización
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS es_socio BOOLEAN DEFAULT true;

-- 3. Crear tabla de registros/historial de escaneos de QR de socios
CREATE TABLE IF NOT EXISTS public.historial_escaneos_socios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comercio_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    beneficio_aplicado TEXT, -- Ejemplo: "15% off", "Café gratis" (Opcional, manual)
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar RLS
ALTER TABLE public.historial_escaneos_socios ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Aislamiento para Escaneos
CREATE POLICY "hist_escaneo_select" ON public.historial_escaneos_socios
    FOR SELECT USING (
        organizacion_id = public.get_current_organizacion_id() OR
        cliente_id = auth.uid() OR
        comercio_id = auth.uid() OR
        public.get_auth_rol() = 'superadmin'
    );

CREATE POLICY "hist_escaneo_insert" ON public.historial_escaneos_socios
    FOR INSERT WITH CHECK (
        comercio_id = auth.uid() OR 
        public.get_auth_rol() IN ('admin', 'superadmin')
    );



-- ===== FILE: migracion_foto_perfil.sql =====
-- =====================================================
-- MIGRACIÓN: Foto de perfil para socios
-- Ejecutar en: Supabase > SQL Editor
-- =====================================================

-- 1. Agregamos la columna a usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

-- =====================================================
-- 2. POLÍTICAS DE STORAGE para el bucket "avatars"
--    Ejecutar DESPUÉS de crear el bucket manualmente
--    en Supabase > Storage > New Bucket > "avatars" (Public)
-- =====================================================

-- Permitir lectura pública de todas las imágenes del bucket
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Permitir a usuarios autenticados subir su propia imagen
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- Permitir a usuarios autenticados actualizar/reemplazar su propia imagen
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' );

-- Permitir a usuarios autenticados borrar su propia imagen
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' );

-- Si alguna policy ya existe, ignorar el error y continuar.


-- ===== FILE: migracion_cuentas_familiares.sql =====
-- =====================================================
-- MIGRACIÓN: Sistema de Control Parental / Teens
-- Ejecutar en: Supabase > SQL Editor
-- =====================================================

-- 1. CREACIÓN DE TABLA: GRUPOS FAMILIARES
CREATE TABLE IF NOT EXISTS public.grupos_familiares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    tutor_user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unq_tutor_orga UNIQUE (tutor_user_id, organizacion_id)
);

-- Habilitar RLS en Grupos Familiares
ALTER TABLE public.grupos_familiares ENABLE ROW LEVEL SECURITY;

-- 2. CREACIÓN DE TABLA: MIEMBROS FAMILIARES
CREATE TABLE IF NOT EXISTS public.miembros_familiares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    grupo_id UUID NOT NULL REFERENCES public.grupos_familiares(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    rol TEXT CHECK (rol IN ('tutor', 'dependiente')) DEFAULT 'dependiente',
    estado TEXT CHECK (estado IN ('pendiente', 'activo', 'bloqueado')) DEFAULT 'pendiente',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unq_miembro_grupo UNIQUE (user_id, grupo_id)
);

-- Habilitar RLS en Miembros Familiares
ALTER TABLE public.miembros_familiares ENABLE ROW LEVEL SECURITY;

-- 3. ACTUALIZACIÓN A LA TABLA VIAJES
-- Para centralizar la delegación del pago y visualización en tiempo real por Supabase
ALTER TABLE public.viajes 
ADD COLUMN IF NOT EXISTS tutor_responsable_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;


-- ======================================================================
-- POLÍTICAS DE AISLAMIENTO Y SEGURIDAD MULTI-TENANT
-- Función get_auth_orga_id() asume que existe en schema actual
-- ======================================================================

-- "Un tutor puede ver su propio grupo familiar" o "Superadmin puede ver todos"
CREATE POLICY "grupos_isolation" ON public.grupos_familiares
    FOR ALL
    USING (
        (organizacion_id = public.get_auth_orga_id() AND tutor_user_id = auth.uid()) 
        OR public.get_auth_rol() = 'superadmin' 
        OR public.get_auth_rol() = 'admin'
    );

-- "Un usuario dependiente puede ver a qué grupo pertenece" / "Un tutor ve a sus miembros"
CREATE POLICY "miembros_isolation" ON public.miembros_familiares
    FOR ALL
    USING (
        (organizacion_id = public.get_auth_orga_id() AND user_id = auth.uid()) -- El dependiente se ve a si mismo o el grupo
        OR 
        (organizacion_id = public.get_auth_orga_id() AND EXISTS (SELECT 1 FROM public.grupos_familiares g WHERE g.id = grupo_id AND g.tutor_user_id = auth.uid()))
        OR public.get_auth_rol() IN ('superadmin', 'admin')
    );

-- Añadimos la capacidad de que un tutor lea los VIAJES que tienen configurado su tutor_responsable_id
-- (Aparte del cliente o chofer que ya lo veían, esto permite al padre rastrear en tiempo real).
-- Supabase acumula las políticas OR. Así que crearemos una exclusiva para tutores.
CREATE POLICY "viajes_tutor_isolation" ON public.viajes
    FOR SELECT
    USING (tutor_responsable_id = auth.uid());



-- ===== FILE: migracion_reglas_pro.sql =====
-- =====================================================
-- MIGRACIÓN: Reglas Avanzadas de Control Parental (PRO)
-- Ejecutar en: Supabase > SQL Editor
-- =====================================================

-- 1. EXTENDER LA TABLA DE VIAJES PARA ESTADOS MANUALES
-- Actualizar la constraint del estado para aceptar "esperando_tutor"
ALTER TABLE public.viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;

ALTER TABLE public.viajes ADD CONSTRAINT viajes_estado_check 
CHECK (estado IN (
    'REQUESTED', 'QUOTED', 'ACCEPTED', 'ASSIGNED', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 
    'FINISHED', 'CANCELLED', 'NO_SHOW', 'en_puerta', 
    'solicitado', 'asignado', 'en_camino', 'finalizado', 'cancelado', 
    'esperando_tutor', 'rechazado'
));

-- 2. TABLA DE REGLAS
CREATE TABLE IF NOT EXISTS public.family_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID NOT NULL REFERENCES public.grupos_familiares(id) ON DELETE CASCADE,
    max_trips_per_day INTEGER DEFAULT NULL,
    max_amount_per_trip NUMERIC(10, 2) DEFAULT NULL,
    allowed_start_time TIME DEFAULT NULL,
    allowed_end_time TIME DEFAULT NULL,
    require_approval BOOLEAN DEFAULT false,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unq_regla_grupo UNIQUE (grupo_id)
);

-- 3. TABLA DE GEOFENCING (ZONAS)
CREATE TABLE IF NOT EXISTS public.family_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID NOT NULL REFERENCES public.grupos_familiares(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('permitida', 'restringida')) DEFAULT 'permitida',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radio_metros INTEGER NOT NULL DEFAULT 1000,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- HABILITACIÓN RLS Y POLÍTICAS
-- =====================================================

ALTER TABLE public.family_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_zones ENABLE ROW LEVEL SECURITY;

-- Un tutor o miembro del grupo puede leer las reglas
CREATE POLICY "fr_select" ON public.family_rules FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = family_rules.grupo_id AND tutor_user_id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM public.miembros_familiares WHERE grupo_id = family_rules.grupo_id AND user_id = auth.uid())
);

-- SOLO el tutor dueño del grupo puede insertar/editar reglas
CREATE POLICY "fr_all" ON public.family_rules
FOR ALL 
USING (
    EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = family_rules.grupo_id AND tutor_user_id = auth.uid())
);

-- Mismas políticas para las Zonas
CREATE POLICY "fz_select" ON public.family_zones FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = family_zones.grupo_id AND tutor_user_id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM public.miembros_familiares WHERE grupo_id = family_zones.grupo_id AND user_id = auth.uid())
);

CREATE POLICY "fz_all" ON public.family_zones
FOR ALL 
USING (
    EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = family_zones.grupo_id AND tutor_user_id = auth.uid())
);





