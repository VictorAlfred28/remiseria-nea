-- ============================================================
-- FASE 1-2: CORRECCIÓN CRÍTICA DE SCHEMA
-- ============================================================
-- Date: 2026-04-20
-- Timestamp: Phase 1-2 Critical Fixes
-- Purpose: Fix missing columns that block driver registration
--
-- Issues Fixed:
-- 1. acepta_registros_publicos NOT in organizaciones (blocks all public registration)
-- 2. Missing fields in choferes: dni, tipo_pago, valor_pago, saldo
-- 3. No unique index on dni (allows duplicates)
--
-- Safety:
-- - All operations use IF NOT EXISTS
-- - No data loss
-- - Fully reversible (see down migration below)
-- ============================================================

-- ============================================================
-- PART 1: FIX ORGANIZACIONES TABLE
-- ============================================================
-- Add missing column that controls public registration
ALTER TABLE public.organizaciones 
ADD COLUMN IF NOT EXISTS acepta_registros_publicos BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.organizaciones.acepta_registros_publicos IS 
  'Controls whether public clients/drivers can register in this organization. Set to false to pause new registrations.';

-- ============================================================
-- PART 2: FIX CHOFERES TABLE - ADD MISSING FIELDS
-- ============================================================

-- Add DNI field (National ID)
ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS dni TEXT;

COMMENT ON COLUMN public.choferes.dni IS 
  'Driver national identification number. Unique per organization.';

-- Add payment method and amount fields
ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS tipo_pago TEXT DEFAULT 'comision' CHECK (tipo_pago IN ('comision', 'base'));

COMMENT ON COLUMN public.choferes.tipo_pago IS 
  'Payment type: comision (percentage per trip) or base (fixed salary)';

ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10, 2) DEFAULT 0.0;

COMMENT ON COLUMN public.choferes.valor_pago IS 
  'Payment value: percentage (comision) or fixed amount (base)';

-- Add balance tracking for payments
ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS saldo NUMERIC(10, 2) DEFAULT 0.0;

COMMENT ON COLUMN public.choferes.saldo IS 
  'Current balance. Positive = money owed to driver. Negative = driver owes platform.';

-- Add debt limit
ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS limite_deuda NUMERIC(10, 2) DEFAULT -2000.0;

COMMENT ON COLUMN public.choferes.limite_deuda IS 
  'Maximum debt allowed (negative value). Driver cannot work if saldo < limite_deuda.';

-- ============================================================
-- PART 3: CREATE INDEXES FOR PERFORMANCE AND UNIQUENESS
-- ============================================================

-- Unique index: DNI must be unique per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_choferes_dni_por_org 
ON public.choferes(organizacion_id, dni) 
WHERE dni IS NOT NULL;

COMMENT ON INDEX idx_choferes_dni_por_org IS 
  'Ensures no two drivers in same organization have same DNI';

-- Performance index for payment lookups
CREATE INDEX IF NOT EXISTS idx_choferes_tipo_pago 
ON public.choferes(organizacion_id, tipo_pago);

COMMENT ON INDEX idx_choferes_tipo_pago IS 
  'Speed up queries by payment method';

-- Performance index for balance queries (collect outstanding debts)
CREATE INDEX IF NOT EXISTS idx_choferes_saldo 
ON public.choferes(organizacion_id, saldo) 
WHERE saldo < 0;

COMMENT ON INDEX idx_choferes_saldo IS 
  'Speed up queries to find drivers with outstanding debts';

-- ============================================================
-- PART 4: VERIFY DATA INTEGRITY
-- ============================================================

-- Log verification results
DO $$
DECLARE
  col_acepta_count INT;
  col_dni_count INT;
  col_tipo_pago_count INT;
BEGIN
  -- Verify organizaciones.acepta_registros_publicos exists
  SELECT COUNT(*) INTO col_acepta_count 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'organizaciones' 
    AND column_name = 'acepta_registros_publicos';
  
  -- Verify choferes.dni exists
  SELECT COUNT(*) INTO col_dni_count 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'choferes' 
    AND column_name = 'dni';
  
  -- Verify choferes.tipo_pago exists
  SELECT COUNT(*) INTO col_tipo_pago_count 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'choferes' 
    AND column_name = 'tipo_pago';
  
  IF col_acepta_count = 1 THEN
    RAISE NOTICE '✅ organizaciones.acepta_registros_publicos created successfully';
  ELSE
    RAISE WARNING '❌ organizaciones.acepta_registros_publicos creation FAILED';
  END IF;
  
  IF col_dni_count = 1 THEN
    RAISE NOTICE '✅ choferes.dni created successfully';
  ELSE
    RAISE WARNING '❌ choferes.dni creation FAILED';
  END IF;
  
  IF col_tipo_pago_count = 1 THEN
    RAISE NOTICE '✅ choferes.tipo_pago created successfully';
  ELSE
    RAISE WARNING '❌ choferes.tipo_pago creation FAILED';
  END IF;
  
END $$;

-- ============================================================
-- DOWN MIGRATION (For Rollback if needed)
-- ============================================================
/*
-- Drop indexes first (safe - no data loss)
DROP INDEX IF EXISTS public.idx_choferes_saldo;
DROP INDEX IF EXISTS public.idx_choferes_tipo_pago;
DROP INDEX IF EXISTS public.idx_choferes_dni_por_org;

-- Drop columns (drops data - use only if absolutely necessary)
-- ALTER TABLE public.choferes DROP COLUMN IF EXISTS limite_deuda;
-- ALTER TABLE public.choferes DROP COLUMN IF EXISTS saldo;
-- ALTER TABLE public.choferes DROP COLUMN IF EXISTS valor_pago;
-- ALTER TABLE public.choferes DROP COLUMN IF EXISTS tipo_pago;
-- ALTER TABLE public.choferes DROP COLUMN IF EXISTS dni;

-- ALTER TABLE public.organizaciones DROP COLUMN IF EXISTS acepta_registros_publicos;
*/

-- ============================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- ============================================================
/*
-- Verify schema changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organizaciones'
  AND column_name = 'acepta_registros_publicos';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'choferes'
  AND column_name IN ('dni', 'tipo_pago', 'valor_pago', 'saldo', 'limite_deuda');

-- Verify indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'choferes' 
  AND indexname LIKE 'idx_choferes%';

-- Test that registration endpoints work
-- POST /public/registro/chofer with test data should NOT throw error 42703
*/
