-- ============================================================
-- MIGRACIÓN: Agregar campo DNI a tabla usuarios
-- Proyecto: Traslados UBI / Remisería NEA
-- Fecha: 2026-05-30
-- Autor: Requerimiento módulo Alta de Titulares
-- ============================================================
--
-- CONTEXTO:
-- Se incorpora el campo DNI obligatorio para los titulares.
-- El DNI se almacena en la tabla usuarios para ser accesible
-- por todos los roles (titular, chofer si aplica, admin).
--
-- SEGURIDAD:
-- La columna no tiene constraint UNIQUE global ya que se permite
-- que un mismo DNI pueda tener distintos roles en el futuro.
-- La validación de unicidad se realiza a nivel de aplicación.

-- ── Agregar columna dni a public.usuarios si no existe ──────────────────────
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS dni TEXT;

CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON public.usuarios(dni);

COMMENT ON COLUMN public.usuarios.dni IS 
'Documento Nacional de Identidad del usuario. Solo dígitos. Validado por la aplicación antes del INSERT.';

-- ── Agregar columna estado a public.usuarios si no existe ───────────────────
-- (Necesaria para que create_chofer pueda hacer UPDATE con "estado")
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';

COMMENT ON COLUMN public.usuarios.estado IS 
'Estado del usuario: pendiente, aprobado, activo, rechazado, bloqueado.';

-- ── Verificar que el trigger handle_new_user existe y está activo ────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created'
    ) THEN
        RAISE WARNING 'ATENCIÓN: El trigger on_auth_user_created NO está instalado. Ejecutar create_trigger_handle_new_user.sql antes de usar el módulo de alta de titulares.';
    ELSE
        RAISE NOTICE '✓ Trigger on_auth_user_created verificado y activo.';
    END IF;
END $$;

-- ── Confirmar migración ─────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '✓ Migración 20260530000000_add_dni_titulares completada.';
    RAISE NOTICE '  - Columna dni agregada a public.usuarios';
    RAISE NOTICE '  - Columna estado agregada a public.usuarios (si no existía)';
    RAISE NOTICE '  - Índice idx_usuarios_dni creado';
END $$;
