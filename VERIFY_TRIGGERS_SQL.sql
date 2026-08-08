-- =========================================================
-- VERIFICAR TRIGGERS Y FUNCIONES CREADAS EXITOSAMENTE
-- =========================================================
-- Ejecuta este query en Supabase SQL Editor para confirmar que todo está instalado

-- 1. Verificar que la función existe
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('sync_vehicle_assignment_to_choferes', 'cleanup_driver_on_vehicle_delete')
AND routine_schema = 'public';

-- Resultado esperado: 2 filas (2 funciones)

---

-- 2. Verificar que los triggers existen
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_%'
AND trigger_schema = 'public'
ORDER BY trigger_name;

-- Resultado esperado: 3 triggers (insert, update, delete)

---

-- 3. Verificar que el índice se creó
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname LIKE 'idx_choferes%'
AND schemaname = 'public';

-- Resultado esperado: 1 índice en tabla choferes

---

-- 4. TEST RÁPIDO: Simular asignación y verificar sync

-- Busca un vehículo y un chofer existentes en tu BD
-- Reemplaza ces UUIDs con valores reales:
-- VEHICLE_UUID y DRIVER_UUID

-- Paso 1: Asignar chofer a vehículo (simula endpoint)
UPDATE public.vehicles
SET driver_id = '[REEMPLAZA_CON_DRIVER_UUID]'
WHERE id = '[REEMPLAZA_CON_VEHICLE_UUID]'
  AND driver_id IS NULL;

-- Paso 2: Verificar que choferes se actualizó automáticamente
SELECT 
  c.id,
  c.usuario_id,
  c.vehiculo,
  c.patente,
  v.marca,
  v.modelo,
  v.patente as v_patente
FROM public.choferes c
LEFT JOIN public.vehicles v ON v.driver_id = c.usuario_id
WHERE c.usuario_id = '[REEMPLAZA_CON_DRIVER_UUID]'
LIMIT 1;

-- Resultado esperado:
-- - c.vehiculo = "marca modelo" (concatenado)
-- - c.patente = v.patente (sincronizado)
-- Si NO coincide → los triggers no se ejecutaron

---

-- 5. Limpiar TEST (restaurar estado anterior)
-- Si realizaste el test anterior, desasigna:
UPDATE public.vehicles
SET driver_id = NULL
WHERE id = '[REEMPLAZA_CON_VEHICLE_UUID]';

-- Verifica que choferes vuelve a "Busca vehículo":
SELECT vehiculo FROM public.choferes
WHERE usuario_id = '[REEMPLAZA_CON_DRIVER_UUID]';

-- Resultado esperado: "Busca vehículo"
