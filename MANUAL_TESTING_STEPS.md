# 🚀 TESTING MANUAL: Sincronización en Tiempo Real

## Preparativos (2 min)

### Paso 0: Abre 2 navegadores
```
Browser A: Abre Chrome (o tu navegador 1)
Browser B: Abre Edge/Firefox (o tu navegador 2)

Ambos:
- Navega a tu app (ej: http://localhost:3000)
- Inicia sesión como ADMIN A en Browser A
- Inicia sesión como ADMIN B en Browser B (cuenta admin diferente, si tienes 2)
  - O MISMA cuenta en incógnito/privada (diferente sesión funciona también)

IMPORTANTE: NO CIERRES LAS PESTAÑAS ENTRE TESTS
```

---

## TEST 1: Estado Inicial (1 min) ✅ RÁPIDO

**Objetivo**: Ambos admins ven vehículos sin chofer correctamente

### Pasos:
```
1. Browser A: Navega a /admin → Tab "Gestión de Flota"
2. Browser B: Navega a /admin → Tab "Gestión de Flota" (MISMA URL en otra pestaña)
3. Esperá 2 segundos a que cargue
4. Busca un vehículo que CLARAMENTE NO tenga chofer:
   - Columna "Chofer": Debe decir "Sin chofer" (ícono XCircle rojo)
   - NO debe haber nombre de chofer
```

### ✅ Resultado esperado:
```
Browser A: Vehículo XYZ → Chofer: "❌ Sin chofer"
Browser B: Vehículo XYZ → Chofer: "❌ Sin chofer"
(Ambos exactamente igual)
```

### ❌ Si falla:
```
- Los datos no cargaron → Espera más
- Recarga la página (F5)
- Verifica que iniciaste sesión como admin
```

✅ **TEST 1 PASSED** → Continúa a TEST 2

---

## TEST 2: Asignación en Tiempo Real (3 min) 🔴 CRÍTICO

**Objetivo**: Browser B ve cambio sin hacer F5 cuando Admin A asigna

### Pasos:
```
1. Browser A: Busca un vehículo SIN CHOFER
   - En la fila, hace hover para que aparezcan botones
   - Click en el ícono de PIN (MapPin) → "Asignar Chofer"

2. Modal aparece. Verás un dropdown con lista de choferes
   - Selecciona UN CHOFER cualquiera (ej: "Juan Pérez")

3. Click botón "Actualizar Asignación" → ESPERA QUE CIERRE MODAL

4. IMPORTANTE: NO HAGAS F5 en Browser B
```

### Observa simultáneamente:
```
Browser A (la que hizo el cambio):
- Modal cierra
- Vuelve a tabla
- Fila del vehículo AHORA DICE: "✅ Juan Pérez" (nombre chofer con ícono verde)

Browser B (la que NO hizo nada):
- Espera 1 segundo...
- La MISMA FILA debería actualizar automáticamente
- Debería mostrar: "✅ Juan Pérez" 
- TODO ESTO SIN HACER F5
```

### ✅ Resultado esperado:
```
[TIEMPO 0s] Admin A hace click asignar
[TIEMPO 1s] Admin A ve cambio en su tabla ✅
[TIEMPO 1-2s] Admin B ve cambio SIN HACER NADA ✅ ← ESTO ES EL REALTIME
```

### ❌ Si Browser B NO se actualiza:
```
PROBLEMA: Realtime listener no está funcionando
DIAGNÓSTICO:
- Abre DevTools en Browser B (F12)
- Ve a Console
- Busca errores
- Busca logs de Supabase

SOLUCIÓN:
1. Recarga página en Browser B (F5)
2. Repite TEST 2
3. Si sigue sin funcionar → problema en Supabase Realtime settings
```

✅ **SI VES CAMBIO AUTOMÁTICO EN BROWSER B → TEST 2 PASSED** 🎉

---

## TEST 3: Desasignación (2 min)

**Objetivo**: Desasignar chofer, ambos lo ven al instante

### Pasos:
```
1. Browser A: Click en el MISMO vehículo que acabas de asignar
   - Click MapPin → Abres modal nuevamente

2. En el dropdown, selecciona la PRIMERA OPCIÓN: "(Sin Chofer)"

3. Click "Actualizar Asignación"

4. Observa ambos navegadores
```

### ✅ Resultado esperado:
```
Browser A:
- Fila ahora muestra: "❌ Sin chofer" (volvió rojo)

Browser B:
- Automáticamente también muestra: "❌ Sin chofer"
- SIN HACER F5
```

✅ **TEST 3 PASSED** → Vamos bien 👍

---

## TEST 4: Cambio de Vehículo (2 min)

**Objetivo**: Reasignar chofer de vehículo A a vehículo B

### Pasos:
```
1. En Browser A, asigna un chofer a VEHÍCULO A (como en TEST 2)
   - Espera a que aparezca en Browser B también
   
2. Ahora, en Browser A:
   - Busca VEHÍCULO B (otro sin chofer)
   - Click MapPin
   - Selecciona EL MISMO CHOFER que tiene VEHÍCULO A
   - Click "Actualizar"

3. Observa lo que pasa:
```

### ✅ Resultado esperado:
```
Antes:
  - VEHÍCULO A: juan Pérez
  - VEHÍCULO B: Sin chofer

Después (automáticamente):
  - VEHÍCULO A: Sin chofer ← se desasignó automáticamente
  - VEHÍCULO B: Juan Pérez ← se asignó

Ambos navegadores muestran esto sin F5
```

### 🔍 Por qué funciona así:
```
- Un chofer no puede tener 2 vehículos
- La lógica del trigger lo desasigna del anterior automáticamente
- Esto es consistencia de datos
```

✅ **TEST 4 PASSED** → Lógica avanzada funcionando ✅

---

## TEST 5: Múltiples Admins Simultáneos (5 min) 🔥 ADVANCED

**Objetivo**: 3+ cambios concurrentes, sin conflictos

### Pasos:
```
1. Abre 3 navegadores:
   - Browser A
   - Browser B  
   - Browser C
   - Todos en /admin → Flota

2. SIMULTÁNEAMENTE (o casi):
   - Admin A: Asigna Chofer X a Vehículo 1
   - Admin B: Asigna Chofer Y a Vehículo 2
   - Admin C: Desasigna Chofer Z de Vehículo 3

3. Observa los 3 navegadores
```

### ✅ Resultado esperado:
```
Todos los navegadores muestran:
- VEHÍCULO 1: Chofer X ✅
- VEHÍCULO 2: Chofer Y ✅
- VEHÍCULO 3: Sin chofer ✅

TODO SINCRONIZADO SIN CONFLICTOS
```

### ❌ Problemas posibles:
```
- Un navegador no vio algún cambio = listener no escucha
- Datos inconsistentes = trigger no ejecutó bien
- Lag > 2 segundos = performance issue
```

✅ **TEST 5 PASSED** = Realtime escalable ✅

---

## TEST 6: Verificar Supabase Network (OPCIONAL - 2 min)

**Objetivo**: Confirmar que WebSocket realtime está conectado

### En Browser A:
```
1. Abre DevTools (F12)
2. Ve a Network tab
3. Filtra por "WebSocket" 
4. Busca conexión a "realtime.supabase.com"
5. Debería estar VERDE (connected)

Si está ROJO o no existe:
- Realtime no está habilitado
- Supabase → Project Settings → Realtime → Enable
```

---

## TEST 7: Verificar BD (OPCIONAL - 2 min)

**Objetivo**: Confirmar que tablas están sincronizadas

### En Supabase SQL Editor:
```
1. Después de asignar un chofer en TEST 2

2. Ejecuta:
SELECT 
  v.id,
  v.marca || ' ' || v.modelo as vehiculo,
  v.driver_id,
  c.usuario_id,
  c.vehiculo as c_vehiculo,
  c.patente as c_patente
FROM public.vehicles v
LEFT JOIN public.choferes c ON c.usuario_id = v.driver_id
WHERE v.driver_id IS NOT NULL
LIMIT 1;

3. Verifica:
   - v.driver_id = c.usuario_id ✅ (son el mismo UUID)
   - c.vehiculo = "Marca Modelo" ✅ (concatenado correctamente)
   - c.patente coincide ✅
```

---

## 📊 RESULTADO FINAL

Rellena esta tabla con los resultados:

| Test | Estado | Signo |
|------|--------|-------|
| TEST 1: Estado Inicial | ✅ PASS | ✓ |
| TEST 2: Asignación Realtime | ✅ PASS | ✓ |
| TEST 3: Desasignación | ✅ PASS | ✓ |
| TEST 4: Cambio de Vehículo | ✅ PASS | ✓ |
| TEST 5: Múltiples Simultáneos | ✅ PASS | ✓ |
| **RESULTADO**: | **✅ TODO FUNCIONA** | **🟢** |

---

## Si algún test FALLA:

### Problema: Browser B no se actualiza
```bash
# Opción 1: Recarga navegador
F5 en Browser B

# Opción 2: Verifica WebSocket
DevTools (F12) → Network → WebSocket → Status 101 (Connected)

# Opción 3: Verifica RLS permissions
Supabase → Authentication → Users → Permissions
```

### Problema: Trigger no sincronizó BD
```bash
# Ve a Supabase SQL y ejecuta manualmente:
SELECT * FROM public.choferes 
WHERE usuario_id = '[DRIVER_UUID]'
LIMIT 1;

# Si vehiculo ≠ "Marca Modelo" → Re-ejecuta migración SQL
```

### Problema: Lag > 2 segundos
```bash
# Es normal si la BD está lenta
# Pero debería ser < 1 segundo típicamente
```

---

## 🎉 ÉXITO CRITERIA

Si TODOS los tests pasan:
- ✅ Sincronización en tiempo real FUNCIONA
- ✅ Múltiples admins sin conflictos
- ✅ Base de datos consistente
- ✅ LISTO PARA PRODUCCIÓN

Reporta los resultados cuando termines los tests.
