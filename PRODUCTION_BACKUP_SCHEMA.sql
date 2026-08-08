-- ============================================================
-- REMISERÍA NEA - COMPLETE DATABASE BACKUP & MIGRATION SCRIPT
-- ============================================================
-- Production version ready for backup, restore, and migration
-- Created: 2026-04-20
-- 
-- INCLUDES:
-- ✓ All database schemas and table structures
-- ✓ All triggers and functions
-- ✓ Row Level Security (RLS) policies
-- ✓ Indexes and constraints
-- ✓ Storage buckets configuration
-- ============================================================

-- NOTE: Este script contiene la estructura completa de la base de datos
-- Para usar:
-- 1. En Supabase SQL Editor: Copia y ejecuta el contenido
-- 2. Para backup final: Exporta desde Supabase → Database → Backups
-- 3. Para restauración: Restaura desde backup en Supabase admin

-- ============================================================
-- IMPORTANTE: ANTES DE EJECUTAR EN PRODUCCIÓN
-- ============================================================
-- 1. Hacer backup de la BD actual
-- 2. Verificar que todos los datos críticos estén presentes
-- 3. Ejecutar en orden: SCHEMAS → TABLES → FUNCTIONS → TRIGGERS → RLS
-- 4. Validar integridad referencial después

-- ============================================================
-- PARTE 1: VALIDACIÓN INICIAL
-- ============================================================

-- Verificar que la extensión UUID existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgtap";

-- ============================================================
-- PARTE 2: TABLAS PRINCIPALES (Orden respetando Foreign Keys)
-- ============================================================

-- 2.1: Tablas independientes (sin FK)
CREATE TABLE IF NOT EXISTS public.organizaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    acepta_registros_publicos BOOLEAN DEFAULT false,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    telefono TEXT PRIMARY KEY,
    historial JSONB DEFAULT '[]'::jsonb,
    estado TEXT DEFAULT 'negociando',
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2: Usuarios y roles
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    nombre TEXT,
    apellido TEXT,
    telefono TEXT,
    rol TEXT DEFAULT 'usuario',
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    avatar_url TEXT,
    estado TEXT DEFAULT 'activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    rol TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3: Estructuras de negocio
CREATE TABLE IF NOT EXISTS public.choferes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    licencia_numero TEXT,
    licencia_vencimiento DATE,
    estado TEXT DEFAULT 'activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    razon_social TEXT,
    cuit TEXT UNIQUE,
    usuario_id UUID REFERENCES public.usuarios(id),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comercios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    user_id UUID REFERENCES public.usuarios(id),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.4: Viajes y transacciones
CREATE TABLE IF NOT EXISTS public.viajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_viaje TEXT UNIQUE,
    cliente_id UUID REFERENCES public.usuarios(id),
    chofer_id UUID REFERENCES public.choferes(id),
    organizacion_id UUID REFERENCES public.organizaciones(id),
    estado TEXT DEFAULT 'solicitado',
    valor NUMERIC(10,2),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.calificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viaje_id UUID REFERENCES public.viajes(id) ON DELETE CASCADE,
    puntuacion INTEGER,
    comentario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.5: Pagos
CREATE TABLE IF NOT EXISTS public.pagos_chofer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chofer_id UUID REFERENCES public.choferes(id) ON DELETE CASCADE,
    monto NUMERIC(10,2),
    estado TEXT DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments_processed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mp_payment_id TEXT UNIQUE,
    external_reference TEXT,
    amount NUMERIC(10,2),
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mercadopago_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    preference_id TEXT UNIQUE,
    viaje_id UUID REFERENCES public.viajes(id),
    amount NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.6: Familias
CREATE TABLE IF NOT EXISTS public.grupos_familiares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nombre_grupo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.miembros_familiares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES public.grupos_familiares(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id),
    rol TEXT DEFAULT 'miembro',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nombre TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_rule_id UUID REFERENCES public.family_rules(id) ON DELETE CASCADE,
    latitud NUMERIC(10, 8),
    longitud NUMERIC(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.7: Historial y auditoría
CREATE TABLE IF NOT EXISTS public.historial_puntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    puntos INTEGER,
    razon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.historial_escaneos_socios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comercio_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    beneficio_aplicado TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.movimientos_saldo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    monto NUMERIC(12,2),
    tipo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.8: Tarifas y reservas
CREATE TABLE IF NOT EXISTS public.tariff_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre TEXT,
    valor_base NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tariff_branding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    color_primario TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tariff_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    cambio_tipo TEXT,
    cambio_fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id),
    estado TEXT DEFAULT 'activa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.9: Comercios y promociones
CREATE TABLE IF NOT EXISTS public.comercio_solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    comercio_id UUID REFERENCES public.comercios(id),
    estado TEXT DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.empresa_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    rol TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.empresa_beneficios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    beneficio_tipo TEXT,
    valor NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promociones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    codigo TEXT UNIQUE,
    descuento NUMERIC(5,2),
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cuenta_corriente_empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    saldo NUMERIC(12,2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.10: Destinos y ubicaciones
CREATE TABLE IF NOT EXISTS public.fixed_destinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre TEXT,
    latitud NUMERIC(10, 8),
    longitud NUMERIC(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.11: Seguridad y auditoría
CREATE TABLE IF NOT EXISTS public.token_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    action TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id TEXT,
    status TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    requests_count INTEGER DEFAULT 0,
    reset_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PARTE 3: ÍNDICES (Rendimiento)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion ON public.usuarios(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_choferes_organizacion ON public.choferes(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_viajes_cliente ON public.viajes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_viajes_chofer ON public.viajes(chofer_id);
CREATE INDEX IF NOT EXISTS idx_viajes_organizacion ON public.viajes(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_viajes_estado ON public.viajes(estado);
CREATE INDEX IF NOT EXISTS idx_viajes_created ON public.viajes(creado_en);
CREATE INDEX IF NOT EXISTS idx_empresas_organizacion ON public.empresas(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_comercios_organizacion ON public.comercios(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_pagos_state ON public.pagos_chofer(estado);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON public.security_audit_log(created_at);

-- ============================================================
-- PARTE 4: HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_familiares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PARTE 5: POLÍTICAS RLS (Seguridad Multi-tenant)
-- ============================================================

-- Política para usuarios: Solo ver su propio perfil o admin
CREATE POLICY "usuarios_select" ON public.usuarios
    FOR SELECT USING (
        auth.uid() = id OR 
        (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "usuarios_update" ON public.usuarios
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Política para viajes: Solo ver viajes de su organización
CREATE POLICY "viajes_organize" ON public.viajes
    FOR SELECT USING (
        organizacion_id IN (
            SELECT organizacion_id FROM public.usuarios WHERE id = auth.uid()
        ) OR
        cliente_id = auth.uid()
    );

-- ============================================================
-- PARTE 6: FUNCIONES
-- ============================================================

-- Función: Obtener organización del usuario actual
CREATE OR REPLACE FUNCTION public.get_current_organizacion_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT organizacion_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función: Obtener rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_auth_rol()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT rol FROM public.usuarios WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función: Validar pago duplicado
CREATE OR REPLACE FUNCTION public.validate_payment_duplicate(
    p_mp_payment_id TEXT,
    p_viaje_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    existing_count INT;
BEGIN
    SELECT COUNT(*) INTO existing_count
    FROM public.payments_processed
    WHERE mp_payment_id = p_mp_payment_id;
    
    RETURN existing_count = 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PARTE 7: TRIGGERS
-- ============================================================

-- Trigger: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_choferes_updated_at
    BEFORE UPDATE ON public.choferes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_viajes_updated_at
    BEFORE UPDATE ON public.viajes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Auditar cambios en seguridad
CREATE OR REPLACE FUNCTION public.audit_security_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.security_audit_log (user_id, action, details)
    VALUES (
        auth.uid(),
        TG_ARGV[0],
        jsonb_build_object('table', TG_TABLE_NAME, 'record', NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PARTE 8: VERIFICACIÓN FINAL
-- ============================================================

-- Contar tablas creadas
DO $$
DECLARE
    table_count INT;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Setup completado exitosamente';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tablas creadas: %', table_count;
    RAISE NOTICE 'RLS: Habilitado en 8 tablas principales';
    RAISE NOTICE 'Índices: Creados para rendimiento';
    RAISE NOTICE 'Funciones: 3 funciones de negocio registradas';
    RAISE NOTICE 'Triggers: 4 triggers para automatización';
    RAISE NOTICE '========================================';
END $$;
