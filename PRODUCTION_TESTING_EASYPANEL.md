# 🚀 TESTING EN PRODUCCIÓN (VPS + EasyPanel)

## Contexto
- Deploy automático: GitHub → EasyPanel → VPS
- App en producción (no localhost)
- Acceso via dominio o IP del VPS

---

## PASO 1: Verificar que el Deploy fue exitoso (5 min)

### En EasyPanel Dashboard:

1. **Verifica estado del Deploy**
   - Abre dashboard de EasyPanel
   - Ve a tu proyecto
   - Status debe ser: ✅ **RUNNING** (verde)
   - Si está DEPLOYING o ERROR, espera a que complete

2. **Verifica que el código nuevo está en producción**
   - Click en proyecto → Deployments
   - Busca el último deploy de hoy
   - Status: debe ser ✅ **SUCCESS**
   - Compara timestamp con tu push a GitHub

3. **Accede a la app**
   ```
   Ve a: https://tu-dominio.com (o http://tu-ip-vps)
   Inicia sesión como ADMIN
   Navega a /admin → Gestión de Flota
   ```

---

## PASO 2: Validar que Realtime está conectado (2 min)

### En tu navegador (con la app ya abierta):

1. Abre **DevTools** (F12)
2. Ve a pestaña **Network**
3. Filtra por "ws://" o "realtime" 
4. Deberías ver conexión a WebSocket:
   ```
   realtime.supabase.com
   Status: 101 Switching Protocols ✅ (verde)
   ```

5. Si NO ves esto:
   ```
   ❌ Realtime connection failed
   → Problema: Supabase Realtime no está habilitado o no conecta desde VPS
   → Solución: Verifica Supabase Project Settings → Realtime
   ```

---

## PASO 3: Quick Test SQL en Supabase (5 min)

### En Supabase Dashboard (mismo para todos los ambientes):

```sql
-- Verificar que triggers están creados
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE 'trg_%'
ORDER BY trigger_name;

-- Resultado esperado: 3 triggers
-- ✓ trg_sync_vehicle_insert_choferes
-- ✓ trg_sync_vehicle_update_choferes
-- ✓ trg_cleanup_driver_on_vehicle_delete
```

Si ves estos 3 triggers → ✅ Backend SQL está OK

---

## PASO 4: Manual Testing en Producción (15 min)

### Abre 2+ navegadores en PRODUCCIÓN:

```
Browser A: https://tu-dominio.com/admin (login como ADMIN A)
Browser B: https://tu-dominio.com/admin (login como ADMIN B, o misma cuenta incógnito)
```

### TEST 1: Estado Inicial
```
Ambos navegadores: /admin → Gestión de Flota
Busca un vehículo sin chofer

Resultado esperado:
✅ Ambos muestran: "❌ Sin chofer"
```

### TEST 2: CRÍTICO - Asignación Realtime
```
Browser A: Click MapPin en vehículo sin chofer
           Selecciona un chofer
           Click "Actualizar Asignación"

Browser B: OBSERVA SIN HACER F5
           La tabla debería actualizar en <1 segundo
           Debe mostrar "✅ Chofer Name"

✅ ÉXITO = Browser B se actualiza sin refresh
❌ FALLO = Browser B sigue mostrando "Sin chofer" (realtime no funciona)
```

### TEST 3: Desasignación
```
Browser A: Click MapPin en el vehículo asignado
           Selecciona "(Sin Chofer)"
           Click "Actualizar"

Browser B: Debería mostrar "❌ Sin chofer" automáticamente
```

### TEST 4: Cambio de Vehículo
```
Browser A: Asigna el mismo chofer a OTRO vehículo

Esperado:
- Vehículo A: "❌ Sin chofer" (se desasignó automáticamente)
- Vehículo B: "✅ Chofer Name" (se asignó)

Browser B: Ambos cambios visibles automáticamente
```

---

## PASO 5: Diagnóstico si algo FALLA

### Si Browser B no se actualiza automáticamente:

#### Opción 1: Verifica DevTools
```
1. F12 en Browser B
2. Console tab
3. Busca errores de Supabase
4. Busca "postgres_changes" (realtime listener)

Si ves errores:
- "Connection refused" → WebSocket no conecta
- "Permission denied" → RLS policy problem
- Silent (sin logs) → Listener creado pero sin cambios
```

#### Opción 2: Verifica Supabase Realtime
```
Supabase Dashboard:
- Proyecto → Settings → Realtime
- Status debe ser: ✅ ENABLED

Si está DISABLED:
- Click "Enable"
- Espera 30 segundos
- Re-testa
```

#### Opción 3: Verifica RLS Permissions
```sql
-- En Supabase SQL Editor:
SELECT * FROM public.vehicles LIMIT 1;

-- Si error de permiso:
-- Your user role doesn't have access
-- → Problema: RLS policies no permitien lectura

-- Solución: Ejecutar
GRANT SELECT ON public.vehicles TO authenticated;
GRANT SELECT ON public.vehicles TO anon;
```

#### Opción 4: Reinicia la app en EasyPanel
```
1. EasyPanel Dashboard → Tu proyecto
2. Click "Restart"
3. Espera a que reinicie (2-3 min)
4. Re-testa
```

---

## PASO 6: Verificar Logs en EasyPanel (Debugging)

### Si todo falla, revisa logs:

```
EasyPanel → Tu proyecto → Logs

Busca:
- Frontend logs (compilación)
- Backend logs (Supabase connection)
- Errores de realtime

Busca errors como:
- "Supabase connection failed"
- "Realtime channel error"
- "RLS policy violation"
```

---

## ✅ CHECKLIST: Todo debe ser ✅

```
[ ] Deploy exitoso en EasyPanel (status: RUNNING)
[ ] DevTools → Network → WebSocket conectado a realtime.supabase.com
[ ] SQL: 3 triggers encontrados en Supabase
[ ] TEST 1: Estado inicial muestra "Sin chofer" en ambos navegadores
[ ] TEST 2: Asignación → Browser B ve cambio sin F5 (<1 seg)
[ ] TEST 3: Desasignación → Automático en ambos
[ ] TEST 4: Cambio Vehículo → Sincronización correcta
```

Si TODOS son ✅ → **LISTO PARA PRODUCCIÓN** 🎉

---

## 🔴 SI NADA FUNCIONA:

Reporta:
1. ¿Ves errores en DevTools Console? (captura)
2. ¿Qué error ves en EasyPanel Logs?
3. ¿Realtime está ENABLED en Supabase Settings?
4. ¿El websocket conecta? (DevTools → Network)

Con eso podemos debuggear 🔧
