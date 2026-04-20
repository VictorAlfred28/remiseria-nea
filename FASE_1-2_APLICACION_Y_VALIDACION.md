# 🚀 INSTRUCCIONES DE APLICACIÓN - FASE 1-2 CRITICAL FIX

## 📋 RESUMEN EJECUTIVO

Esta migración soluciona el error crítico: `column organizaciones.acepta_registros_publicos does not exist (ERROR 42703)`

**Archivos involucrados:**
- Nueva migración: `supabase/migrations/20260420120000_fix_schema_chofer_organizacion.sql`
- Propósito: Añadir columnas faltantes que bloquean registro de choferes

**Duración estimada:** 5-10 minutos

---

## 🔍 VERIFICACIÓN PREVIA (ANTES DE APLICAR)

### Paso 1: Verificar Estado Actual de Supabase

Abre Supabase Dashboard → SQL Editor y ejecuta:

```sql
-- Verificar si columna EXISTE en organizaciones
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'organizaciones'
  AND column_name = 'acepta_registros_publicos';
```

**Resultado esperado:** 0 filas (columna NO existe aún)

```sql
-- Verificar si campos EXISTEN en choferes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'choferes'
  AND column_name IN ('dni', 'tipo_pago', 'valor_pago', 'saldo', 'limite_deuda');
```

**Resultado esperado:** 0-3 filas (falta al menos `dni`, `tipo_pago`, `valor_pago`)

---

## ⚡ APLICAR MIGRACIÓN

### Opción A: Supabase Cloud (Recomendado)

1. **Supabase Dashboard** → SQL Editor
2. **Copiar TODO el contenido** de:
   ```
   supabase/migrations/20260420120000_fix_schema_chofer_organizacion.sql
   ```
3. **Pegar en editor SQL**
4. **Click "RUN"** (o Ctrl+Enter)
5. **Esperar** confirmación ✓ (debe decir "Query executed successfully")

### Opción B: CLI Local (Si tienes Supabase CLI configurado)

```bash
cd /path/to/remiseria-nea-main
supabase db push
# Ejecuta todas las migraciones pendientes en order
```

### Opción C: Manual Directo (SOLO SI ES NECESARIO)

Si la anterior no funciona, copiar SOLO las primeras secciones:

```sql
-- PART 1: FIX ORGANIZACIONES TABLE
ALTER TABLE public.organizaciones 
ADD COLUMN IF NOT EXISTS acepta_registros_publicos BOOLEAN DEFAULT true;

-- PART 2: FIX CHOFERES TABLE
ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS dni TEXT;

ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS tipo_pago TEXT DEFAULT 'comision' CHECK (tipo_pago IN ('comision', 'base'));

ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10, 2) DEFAULT 0.0;

ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS saldo NUMERIC(10, 2) DEFAULT 0.0;

ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS limite_deuda NUMERIC(10, 2) DEFAULT -2000.0;
```

---

## ✅ VALIDACIÓN POST-MIGRACIÓN

Después de ejecutar, valida que TODO se creó correctamente:

### Validación 1: Columnas en ORGANIZACIONES

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'organizaciones'
  AND column_name = 'acepta_registros_publicos';
```

**Resultado esperado:**
```
column_name                    | data_type | column_default           | is_nullable
-------------------------------|-----------|-------------------------|-------------
acepta_registros_publicos      | boolean   | true                     | YES
```

✅ Si ves 1 fila → OK

### Validación 2: Columnas en CHOFERES

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'choferes'
  AND column_name IN ('dni', 'tipo_pago', 'valor_pago', 'saldo', 'limite_deuda')
ORDER BY column_name;
```

**Resultado esperado:**
```
column_name    | data_type       | column_default | is_nullable
---------------|-----------------|----------------|-------------
dni            | text            | NULL           | YES
limite_deuda   | numeric(10,2)   | -2000.0        | YES
saldo          | numeric(10,2)   | 0.0            | YES
tipo_pago      | text            | 'comision'     | YES
valor_pago     | numeric(10,2)   | 0.0            | YES
```

✅ Si ves 5 filas → OK

### Validación 3: Índices Creados

```sql
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'choferes' 
  AND indexname LIKE 'idx_choferes%'
ORDER BY indexname;
```

**Resultado esperado:** 3 índices nuevos
- `idx_choferes_dni_por_org`
- `idx_choferes_saldo`
- `idx_choferes_tipo_pago`

✅ Si ves 3+ índices → OK

---

## 🧪 PRUEBA FUNCIONAL

Después de validar schema, prueba que el endpoint ya funciona:

### Test 1: Registro de Chofer (App)

```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-user-1",
    "organizacion_id": "<ORG_ID_VALIDO>",
    "email": "chofer_test_1@example.com",
    "nombre": "Chofer Test",
    "telefono": "3794123456",
    "direccion": "Av. Test 123",
    "vehiculo": "Toyota Prius",
    "patente": "AB123CD",
    "licencia_numero": "30123456",
    "licencia_categoria": "D1",
    "licencia_vencimiento": "2030-12-31",
    "documentos": [],
    "tiene_vehiculo": true
  }'
```

**Resultado esperado:**
```json
{
  "status": "ok",
  "chofer": { ... datos del chofer ... }
}
```

❌ Si ves `ERROR 42703` → LA MIGRACIÓN NO SE APLICÓ
✅ Si ves `status: ok` → FUNCIONA ✓

### Test 2: Crear Chofer desde Admin

```bash
curl -X POST http://localhost:8000/api/v1/admin/chofer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "nombre": "Chofer Admin Test",
    "email": "chofer_admin_1@example.com",
    "telefono": "3794987654",
    "vehiculo": "Honda Civic",
    "patente": "XY789ZW",
    "dni": "30555666",
    "tipo_pago": "comision",
    "valor_pago": 25.0
  }'
```

**Resultado esperado:**
```json
{
  "id": "...",
  "nombre": "Chofer Admin Test",
  "email": "chofer_admin_1@example.com",
  "password_temporal": "..."
}
```

❌ Si falla → Reportar error
✅ Si sucede → FUNCIONA ✓

---

## 📊 CHECKLIST DE VALIDACIÓN

- [ ] **Pre-migración**: Verificar que columnas NO existen (0 filas)
- [ ] **Migración**: Ejecutada sin errores en SQL Editor
- [ ] **Post-migración**: Validación 1 ✓ (organizaciones.acepta_registros_publicos existe)
- [ ] **Post-migración**: Validación 2 ✓ (5 columnas en choferes)
- [ ] **Post-migración**: Validación 3 ✓ (3 índices creados)
- [ ] **Test funcional 1**: Registro app sin error 42703
- [ ] **Test funcional 2**: Admin puede crear chofer con dni, tipo_pago, valor_pago
- [ ] **Logs**: Sin excepciones en backend

---

## 🔄 EN CASO DE ERROR

### Error: "Column already exists"

**Causa:** La migración anterior (20260420100000) ya fue aplicada pero incompleta

**Solución:** 
```sql
-- Ejecutar SOLO PART 2 y PART 3 (saltar PART 1)
-- Las operaciones con IF NOT EXISTS son seguras
```

### Error: "Constraint violation" en CHECK

**Causa:** `tipo_pago` tiene valor inválido en datos existentes

**Solución:**
```sql
-- Actualizar valores existentes antes del CHECK
UPDATE public.choferes 
SET tipo_pago = 'comision' 
WHERE tipo_pago IS NULL OR tipo_pago NOT IN ('comision', 'base');
```

### Error: "Unique constraint violation" en índice DNI

**Causa:** Existen choferes duplicados con mismo DNI en misma org

**Solución:**
```sql
-- Ver duplicados
SELECT organizacion_id, dni, COUNT(*) 
FROM public.choferes 
WHERE dni IS NOT NULL
GROUP BY organizacion_id, dni 
HAVING COUNT(*) > 1;

-- Decidir qué hacer con duplicados:
-- Opción A: Asignar DNI NULL a duplicados
UPDATE public.choferes 
SET dni = NULL 
WHERE id IN (SELECT id FROM ... duplicados aquí);

-- Opción B: Limpiar registros de prueba
DELETE FROM public.choferes WHERE email LIKE '%test%';
```

---

## 📞 ROLLBACK (Si es necesario)

La migración es **totalmente reversible**. Si necesitas volver atrás:

```sql
-- DROP indexes (SAFE - no data loss)
DROP INDEX IF EXISTS public.idx_choferes_saldo;
DROP INDEX IF EXISTS public.idx_choferes_tipo_pago;
DROP INDEX IF EXISTS public.idx_choferes_dni_por_org;

-- DROP columns (⚠️ DROPS DATA - use only if absolutely necessary)
ALTER TABLE public.choferes DROP COLUMN IF EXISTS limite_deuda CASCADE;
ALTER TABLE public.choferes DROP COLUMN IF EXISTS saldo CASCADE;
ALTER TABLE public.choferes DROP COLUMN IF EXISTS valor_pago CASCADE;
ALTER TABLE public.choferes DROP COLUMN IF EXISTS tipo_pago CASCADE;
ALTER TABLE public.choferes DROP COLUMN IF EXISTS dni CASCADE;

ALTER TABLE public.organizaciones DROP COLUMN IF EXISTS acepta_registros_publicos CASCADE;
```

---

## 📝 REPORTAR DESPUÉS

Una vez validado todo, reportar:

1. ✅ Fecha/hora de aplicación
2. ✅ Método usado (Supabase UI / CLI / Manual)
3. ✅ Resultado de todas las validaciones (copy-paste de queries)
4. ✅ Tests funcionales ejecutados y resultado
5. ✅ Logs del backend sin excepciones

**Ejemplo de reporte:**
```
FASE 1-2 APPLIED SUCCESSFULLY

📅 Fecha: 2026-04-20 14:30 UTC
🔧 Método: Supabase SQL Editor
✅ All validations passed
✅ Test 1 (App registro): OK
✅ Test 2 (Admin chofer): OK
⏭️ Ready for Phase 3 (Formulario unification)
```

---

## 🚀 SIGUIENTE PASO

Una vez Fase 1-2 validada exitosamente:

→ Proceder a **Fase 3: Unificación de Formularios**
→ Alinear app + admin panel
→ Normalizar DTO único de Chofer
→ Implementar login con DNI/email

