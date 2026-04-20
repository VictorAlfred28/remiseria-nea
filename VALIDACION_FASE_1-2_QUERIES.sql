-- ============================================================
-- VALIDACIÓN POST-MIGRACIÓN FASE 1-2
-- ============================================================
-- Ejecuta CADA query por separado en Supabase SQL Editor
-- Copia los resultados en el reporte final
-- ============================================================

-- ============================================================
-- VALIDACIÓN 1: Column acepta_registros_publicos en ORGANIZACIONES
-- ============================================================
SELECT 
  column_name, 
  data_type, 
  column_default, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'organizaciones'
  AND column_name = 'acepta_registros_publicos';

-- Resultado esperado: 1 fila con:
-- column_name: acepta_registros_publicos
-- data_type: boolean
-- column_default: true
-- is_nullable: YES

-- ============================================================
-- VALIDACIÓN 2: 5 Columnas nuevas en CHOFERES
-- ============================================================
SELECT 
  column_name, 
  data_type, 
  column_default, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'choferes'
  AND column_name IN ('dni', 'tipo_pago', 'valor_pago', 'saldo', 'limite_deuda')
ORDER BY column_name;

-- Resultado esperado: 5 filas
-- dni | text | NULL | YES
-- limite_deuda | numeric | -2000.0 | YES
-- saldo | numeric | 0.0 | YES
-- tipo_pago | text | 'comision' | YES
-- valor_pago | numeric | 0.0 | YES

-- ============================================================
-- VALIDACIÓN 3: 3 Índices nuevos en CHOFERES
-- ============================================================
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'choferes' 
  AND indexname LIKE 'idx_choferes%'
ORDER BY indexname;

-- Resultado esperado: 3 filas
-- idx_choferes_dni_por_org
-- idx_choferes_saldo
-- idx_choferes_tipo_pago

-- ============================================================
-- VALIDACIÓN 4: Verificar que organizaciones tienen el valor default
-- ============================================================
SELECT 
  id,
  nombre,
  acepta_registros_publicos
FROM public.organizaciones
LIMIT 5;

-- Resultado esperado: acepta_registros_publicos = true para todas

-- ============================================================
-- VALIDACIÓN 5: Chequear constraints en tipo_pago
-- ============================================================
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name = 'choferes'
  AND constraint_type = 'CHECK';

-- Resultado esperado: constraint con tipo_pago IN ('comision', 'base')

-- ============================================================
-- RESUMEN RÁPIDO (Copy-paste para validación rápida)
-- ============================================================
SELECT 
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name='organizaciones' AND column_name='acepta_registros_publicos') as org_acepta_column,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name='choferes' AND column_name IN ('dni','tipo_pago','valor_pago','saldo','limite_deuda')) as chofer_columns_count,
  (SELECT COUNT(*) FROM pg_indexes 
   WHERE tablename='choferes' AND indexname LIKE 'idx_choferes%') as indexes_count;

-- Resultado esperado: 1 | 5 | 3
-- Si ves esto → TODO ESTÁ OK ✅
