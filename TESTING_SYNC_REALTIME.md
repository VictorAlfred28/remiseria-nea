# 🧪 Testing: Sincronización Automática de Vehículos en Flota

## Prerequisitos
- Migración SQL ejecutada en Supabase ✅
- Frontend compilado ✅
- 2+ navegadores/pestañas abiertas con sesiones de admin diferentes

---

## 📋 Casos de Testing

### TEST 1: Sincronización Inicial (Vehículo sin chofer)
**Objetivo**: Verificar que un vehículo sin asignación muestra "Sin chofer" en ambos admins

**Pasos**:
1. Abre Browser A: `/admin` → Tab "Gestión de Flota"
2. Abre Browser B: `/admin` → Tab "Gestión de Flota" (mismo usuario distinta sesión, o diferente admin)
3. En Browser A: Busca un vehículo que NO tenga chofer asignado
4. En Browser B: Busca el MISMO vehículo

**Resultado esperado**:
- ✅ Ambos navegadores muestran "Sin chofer" en la columna "Chofer"
- ✅ El botón MapPin (asignar) está visible

---

### TEST 2: Asignación en Tiempo Real
**Objetivo**: Un admin asigna chofer, el otro lo ve instantáneamente

**Pasos**:
1. En Browser A: Click MapPin en el vehículo sin chofer
2. Modal aparece. Selecciona un chofer de la lista
3. Click "Actualizar Asignación"
4. IMPORTANTE: **NO HAGAS F5 EN BROWSER B**

**Resultado esperado**:
- ✅ Browser A: El modal cierra, vuelve a lista, y la fila del vehículo ahora muestra el nombre del chofer (ej: "Juan Pérez")
- ✅ Browser B: **AUTOMÁTICAMENTE** (<1 segundo) actualiza la misma fila mostrando "Juan Pérez" SIN refresh manual
- ✅ Ambos ven: ✓ Juan Pérez (con ícono CheckCircle verde)

**Indicador de éxito**: Si Browser B se actualiza sin hacer nada, el realtime está funcionando 🟢

---

### TEST 3: Desasignación en Tiempo Real
**Objetivo**: Quitar chofer, ambos lo ven al instante

**Pasos**:
1. En Browser A: Click MapPin en el vehículo que ACABAS DE ASIGNAR
2. Modal abre. Campo dice "[Nombre chofer]"
3. Click en el dropdown, selecciona "(Sin Chofer)" (primera opción)
4. Click "Actualizar Asignación"

**Resultado esperado**:
- ✅ Browser A: Fila vuelve a mostrar "Sin chofer" (con ícono XCircle rojo)
- ✅ Browser B: **Automáticamente** actualiza mostrando "Sin chofer" (<1 seg, sin F5)
- ✅ La tabla sincroniza en tiempo real

---

### TEST 4: Cambio de Vehículo (Reasignación)
**Objetivo**: Cambiar un chofer de un vehículo a otro

**Pasos**:
1. Asegúrate que Chofer X tiene Vehículo A asignado
2. En Browser A: Asigna Chofer X a Vehículo B
3. Observa Browser B sin hacer nada

**Resultado esperado**:
- ✅ Browser A: Vehículo B ahora muestra "Chofer X"
- ✅ Browser A: Vehículo A ahora muestra "Sin chofer" (se desasignó automáticamente)
- ✅ Browser B: Ambos cambios aparecen automáticamente (<1 seg)
- ✅ No hay inconsistencia: un chofer no puede tener 2 vehículos

---

### TEST 5: Múltiples Admins Simultáneos
**Objetivo**: 3+ cambios concurrentes se sincronizan correctamente

**Pasos**:
1. Abre 3+ navegadores con FlotaAdminTab activa
2. Admin A: Asigna Chofer 1 a Vehículo A
3. Admin B: Asigna Chofer 2 a Vehículo B (simultáneamente)
4. Admin C: Desasigna Chofer 3 de Vehículo C
5. Observa todos los cambios en todas las ventanas

**Resultado esperado**:
- ✅ Cada navegador ve TODOS los cambios de los otros instantáneamente
- ✅ NO hay lag ni retrasos
- ✅ NO hay conflictos (ej: un chofer asignado a 2 vehículos)
- ✅ La tabla final es consistente en todos los navegadores

---

### TEST 6: AdminDashboard Fleet Tab (Realtime)
**Objetivo**: Verificar que el tab de Fleet en AdminDashboard también sincroniza

**Pasos**:
1. En Browser A: Ve a `/admin` → Tab "Flota" (si existe, busca el tab que use tabla choferes)
2. En Browser B: Mismo navegador, mismo tab
3. En Browser A (FlotaAdminTab): Asigna un chofer a un vehículo
4. Observa si el cambio aparece en Browser B (AdminDashboard Fleet)

**Resultado esperado**:
- ✅ Browser B actualiza automáticamente sin F5
- ✅ El vehículo asignado aparece en el registro del chofer
- ✅ Sincronización bidireccional funciona

---

### TEST 7: Base de Datos Consistencia (Verificar Triggers)
**Objetivo**: Confirmar que la BD está sincronizada correctamente

**Pasos**:
1. Abre Supabase Dashboard → Table Editor
2. Busca tabla `vehicles` → Encuentra un vehículo que acabas de asignar
3. Verifica: `driver_id` tiene UUID del chofer
4. Busca tabla `choferes` → Encuentra el registro del chofer
5. Verifica: `vehiculo` = "Marca Modelo" (sincronizado)
6. Verifica: `usuario_id` = UUID del chofer

**Resultado esperado**:
- ✅ `vehicles.driver_id` = `choferes.usuario_id` (mismo UUID)
- ✅ `choferes.vehiculo` = marca + modelo del vehículo
- ✅ Ambas tablas están sincronizadas (triggers funcionando)

---

## 🐛 Si algo NO funciona:

### Problema: Browser B NO se actualiza automáticamente
**Diagnóstico**:
1. Abre DevTools (F12) → Console
2. Busca errores de Supabase realtime
3. Verifica que el listener está activo: busca logs como "postgres_changes"
4. Confirma que Realtime está habilitado en Supabase Settings → Realtime

**Solución**:
- Reload página (F5) en el navegador que no actualiza
- Verifica que el usuario tiene permisos RLS correctos
- Confirma que la migración SQL se ejecutó exitosamente

### Problema: Tabla choferes NO se actualiza después de asignar
**Diagnóstico**:
1. Abre Supabase SQL Editor
2. Ejecuta: `SELECT * FROM public.choferes WHERE usuario_id = '[USER_ID]' LIMIT 1;`
3. Verifica si el campo `vehiculo` tiene valor

**Solución**:
- Los triggers SQL pueden no haberse ejecutado
- Re-ejecuta la migración SQL desde Supabase Dashboard
- Verifica que la función y triggers se crearon: SQL Editor → busca función `sync_vehicle_assignment_to_choferes`

### Problema: Un vehículo desasignado no vuelve a "Busca vehículo"
**Diagnóstico**:
- Verifica que el chofer registro existe en tabla `choferes`
- Confirma que `usuario_id` coincide con `vehicles.driver_id`

**Solución**:
- Ejecuta manualmente en Supabase SQL Editor:
```sql
UPDATE public.choferes
SET vehiculo = 'Busca vehículo'
WHERE usuario_id = '[DRIVER_UUID]'
  AND organizacion_id = '[ORG_ID]';
```

---

## ✅ Criterio de Éxito

Todos los tests pasan si:

1. ✅ **Realtime funciona**: Cambios en un navegador aparecen en otro (<1 seg, sin F5)
2. ✅ **Bidireccional**: Sincronización funciona en ambas direcciones (asignar/desasignar)
3. ✅ **Concurrente**: Múltiples admins cambian simultáneamente sin conflictos
4. ✅ **Consistencia BD**: `vehicles` y `choferes` siempre están sincronizadas
5. ✅ **UI correcta**: 
   - Vehículo sin chofer: muestra "Sin chofer" (ícono XCircle rojo)
   - Vehículo con chofer: muestra nombre/marca (ícono CheckCircle verde)
6. ✅ **No requiere refresh**: Sin F5 manual

---

## 📊 Reporte de Testing

**Ejecuta estos 7 tests y reporta resultados:**

| Test | Paso 1 | Paso 2 | Paso 3 | Resultado | Notas |
|------|--------|--------|--------|-----------|-------|
| TEST 1: Inicial | ✅ | ✅ | ✅ | ✅ PASS |  |
| TEST 2: Asignación | ✅ | ✅ | ✅ | ✅ PASS |  |
| TEST 3: Desasignación | ✅ | ✅ | ✅ | ✅ PASS |  |
| TEST 4: Cambio Vehículo | ✅ | ✅ | ✅ | ✅ PASS |  |
| TEST 5: Múltiples | ✅ | ✅ | ✅ | ✅ PASS |  |
| TEST 6: AdminDashboard | ✅ | ✅ | ✅ | ✅ PASS |  |
| TEST 7: BD Consistencia | ✅ | ✅ | ✅ | ✅ PASS |  |

**Cuando todos sean PASS**: 🎉 Sincronización en tiempo real ✅ EXITOSA

---

## 🚀 Qué hacer después

Si todos los tests PASAN:
1. Mergear a `main` / `production`
2. Deploy a producción
3. Documentar en CONFIRMACION_GITHUB.md

Si alguno FALLA:
1. Ejecutar diagnóstico de arriba
2. Aplicar solución
3. Re-testear
4. Reportar error

