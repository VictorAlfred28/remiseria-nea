-- ========================
-- QUICK TEST: Verificar que Triggers funcionan
-- ========================
-- Ejecuta PASO A PASO en Supabase SQL Editor

-- PASO 1: Ver la lista de vehículos sin chofer asignado
SELECT id, marca, modelo, driver_id, patente 
FROM public.vehicles 
WHERE driver_id IS NULL 
LIMIT 3;

-- Anota el VEHICLE_UUID de alguno de estos resultados
-- Ej: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

---

-- PASO 2: Ver la lista de choferes disponibles
SELECT id, usuario_id, vehiculo, patente 
FROM public.choferes 
WHERE vehiculo = 'Busca vehículo' 
LIMIT 3;

-- Anota el DRIVER_UUID de alguno de estos resultados
-- Ej: "f1e2d3c4-b5a6-9876-5432-10fedcba9876"

---

-- PASO 3: ASIGNAR CHOFER A VEHÍCULO (simula lo que hace el endpoint)
-- Reemplaza VEHICLE_UUID y DRIVER_UUID con los valores que anotaste arriba
UPDATE public.vehicles
SET driver_id = 'REEMPLAZA_CON_DRIVER_UUID'
WHERE id = 'REEMPLAZA_CON_VEHICLE_UUID';

-- Ejecuta este query

---

-- PASO 4: VERIFICAR QUE EL TRIGGER ACTUALIZÓ LA TABLA CHOFERES
-- Reemplaza DRIVER_UUID con el mismo que usaste en PASO 3
SELECT id, usuario_id, vehiculo, patente 
FROM public.choferes 
WHERE usuario_id = 'REEMPLAZA_CON_DRIVER_UUID'
LIMIT 1;

-- ✅ ÉXITO si:
-- - vehiculo = "Marca Modelo" (concatenado, NO "Busca vehículo")
-- - patente = coincide con el vehículo asignado

-- ❌ FALLO si:
-- - vehiculo sigue siendo "Busca vehículo"
-- - patente no cambió
-- = Los triggers NO ejecuaron

---

-- PASO 5: DESASIGNAR CHOFER (vuelve a NULL)
-- Reemplaza VEHICLE_UUID con el mismo de PASO 3
UPDATE public.vehicles
SET driver_id = NULL
WHERE id = 'REEMPLAZA_CON_VEHICLE_UUID';

---

-- PASO 6: VERIFICAR QUE EL TRIGGER LIMPIÓ LA TABLA CHOFERES
-- Reemplaza DRIVER_UUID con el mismo de PASO 3
SELECT id, usuario_id, vehiculo, patente 
FROM public.choferes 
WHERE usuario_id = 'REEMPLAZA_CON_DRIVER_UUID'
LIMIT 1;

-- ✅ ÉXITO si:
-- - vehiculo = "Busca vehículo" (volvió automáticamente)

-- ❌ FALLO si:
-- - vehiculo sigue siendo "Marca Modelo"
-- = El trigger de DELETE NO ejecutó

---

-- RESUMEN:
-- Si PASO 4 y PASO 6 son correctos → ✅ TRIGGERS FUNCIONAN
-- Procede a TESTS MANUALES en el navegador
