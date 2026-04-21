# 🚨 ERROR 400 - GUÍA RÁPIDA DE REFERENCIA

## Si ves `HTTP 400 Bad Request` en `/api/v1/public/registro/chofer`

### 📋 Paso 1: Leer el Mensaje de Error

El servidor ahora retorna un mensaje estructurado como:

```json
{
  "detail": "Explicación clara del problema"
}
```

**Este es el mensaje que debes buscar:**

---

## 🔍 Mapeo de Errores 400 Comunes

### Error: "Organización no válida"

**Causa:** El `organizacion_id` no existe en la BD

**Solución:**
1. Verificar que pasas un `organizacion_id` válido
2. Si no sabes cuál es, usar: `GET /api/v1/public/organizaciones/default`
3. Validar en BD: `SELECT id FROM organizaciones WHERE id = '{tu-id}'`

```bash
# Test rápido
curl -X GET http://localhost:8000/api/v1/public/organizaciones/default
```

---

### Error: "Email ya registrado en esta organización"

**Causa:** El email ya está registrado en esa org

**Solución:**
1. Cambiar email a uno nuevo
2. O verificar en BD si ese email ya existe: `SELECT * FROM usuarios WHERE email = '{email}'`

```javascript
// Generar email único para test
const email = `test-${Date.now()}@example.com`;
```

---

### Error: "DNI ya registrado en esta organización"

**Causa:** El DNI ya está registrado en esa org

**Solución:**
1. Cambiar DNI a uno nuevo/diferente
2. O verificar en BD: `SELECT * FROM choferes WHERE dni = '{dni}'`

```javascript
// Generar DNI único para test
const dni = `DNI-${Date.now()}`;
```

---

### Error: "Teléfono inválido (debe tener mínimo 10 dígitos...)"

**Causa:** El teléfono tiene < 10 dígitos

**Solución:**
1. Asegurar que el teléfono tiene AL MENOS 10 dígitos
2. Los espacios y guiones se ignoran automáticamente

```javascript
// ✓ Válidos
const phone1 = "1123456789";      // 10 dígitos
const phone2 = "11 2345 6789";    // Espacios ignorados
const phone3 = "11-2345-6789";    // Guiones ignorados

// ✗ Inválidos
const phone4 = "123";             // Muy corto
```

---

### Error: "Licencia vencida (vencimiento: YYYY-MM-DD)..."

**Causa:** La fecha de vencimiento de licencia es ≤ hoy

**Solución:**
1. Usar una fecha FUTURA (> de hoy)
2. Formato: `YYYY-MM-DD`
3. Ejemplo hoy 2026-04-21 → usar 2026-12-31

```javascript
// Generar fecha futura
const futureDate = new Date();
futureDate.setFullYear(futureDate.getFullYear() + 1);
const licenseDate = futureDate.toISOString().split('T')[0];  // 2027-04-21
```

---

### Error: "Formato de fecha licencia inválido. Use YYYY-MM-DD..."

**Causa:** El formato de fecha es incorrecto

**Solución:**
1. Formato requerido: `YYYY-MM-DD`
2. Ejemplos:
   - ✓ `2026-12-31`
   - ✓ `2027-06-15`
   - ✗ `12/31/2026`
   - ✗ `31-12-2026`

---

### Error: "Patente es requerida si tiene_vehiculo=True"

**Causa:** Dijiste que tiene vehículo (`tiene_vehiculo: true`) pero no pasaste patente

**Solución:**
1. Si SÍ tiene vehículo: proporcionar `patente`
2. Si NO tiene vehículo: dejar `tiene_vehiculo: false` (default)

```json
{
  "tiene_vehiculo": false,
  "patente": null
}
```

---

### Error: "Patente inválida (debe tener 6-8 caracteres...)"

**Causa:** La patente tiene < 6 o > 8 caracteres

**Solución:**
1. La patente debe tener EXACTAMENTE 6-8 caracteres
2. Ejemplos:
   - ✓ `ABC1234` (7 chars)
   - ✓ `AB12345` (7 chars)
   - ✗ `ABC12` (5 chars)
   - ✗ `ABC12345678` (11 chars)

```javascript
// Generar patente válida
const plate = "ABC" + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
// Resultado: ABC1234 (7 chars)
```

---

### Error: "Esta organización no acepta registros de choferes en este momento"

**Causa:** La org tiene `acepta_registros_publicos = false`

**Solución:**
1. Esta es una restricción de la organización
2. Contactar a admin de la organización para que habilite registros públicos
3. O usar endpoint `/admin/chofer` con credenciales de admin

---

## 🛠️ Validación Rápida de Datos

### JSON Válido Mínimo

```json
{
  "nombre": "Juan Pérez García",
  "email": "juan@example.com",
  "telefono": "1123456789",
  "dni": "12345678",
  "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
  "tiene_vehiculo": false
}
```

### JSON Válido Completo (con vehículo)

```json
{
  "nombre": "Juan Pérez García",
  "email": "juan@example.com",
  "telefono": "1123456789",
  "dni": "12345678",
  "direccion": "Calle Principal 123",
  "licencia_numero": "LIC123456",
  "licencia_categoria": "B",
  "licencia_vencimiento": "2027-12-31",
  "tiene_vehiculo": true,
  "vehiculo": "Toyota Corolla 2020",
  "patente": "ABC1234",
  "documentos": [],
  "tipo_pago": "comision",
  "valor_pago": 0.0,
  "organizacion_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 📊 Checklist Previo a Request

Antes de enviar, verificar:

- [ ] `nombre` → mínimo 2 caracteres
- [ ] `email` → formato válido (algo@algo.com)
- [ ] `telefono` → mínimo 10 dígitos
- [ ] `dni` → presente (formato libre)
- [ ] `organizacion_id` → UUID válido existente
- [ ] `licencia_vencimiento` → Si se incluye, debe ser futuro (YYYY-MM-DD)
- [ ] `tiene_vehiculo: true` → Si es true, `patente` obligatorio (6-8 chars)
- [ ] `tiene_vehiculo: false` → `patente` puede ser null

---

## 🔧 Debugging Avanzado

### Ver Logs del Servidor

Si tienes acceso al servidor:

```bash
# Docker
docker logs <container_name> | grep -i "chofer\|error\|❌"

# Local
# Los logs aparecen en stdout
tail -f /var/log/app/output.log | grep "chofer"
```

### Buscar en Logs

```bash
# Buscar errores del usuario específico
grep "juan@example.com" /var/log/app/output.log

# Ver validaciones fallidas
grep "Validation failed on field" /var/log/app/output.log

# Ver requests de registro
grep "DRIVER REGISTRATION REQUEST" /var/log/app/output.log
```

---

## 🧪 Testing Rápido con curl

### Test 1: Request Válida

```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test User",
    "email": "test@example.com",
    "telefono": "1123456789",
    "dni": "12345678",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "tiene_vehiculo": false
  }'
```

### Test 2: Teléfono Inválido (para reproducir error)

```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test User",
    "email": "test@example.com",
    "telefono": "123",
    "dni": "12345678",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "tiene_vehiculo": false
  }'
```

**Respuesta esperada:**
```json
{
  "detail": "Teléfono inválido (debe tener mínimo 10 dígitos, recibido: 123)"
}
```

---

## 📞 Si Nada Funciona

1. **Verificar que el servidor está corriendo**
   ```bash
   curl http://localhost:8000/  # Debe retornar 200
   ```

2. **Verificar que la DB está accesible**
   - Conectarse a Supabase y verificar que existen las tablas
   - Verificar credenciales de conexión en `.env`

3. **Ver logs del servidor completos**
   - Buscar líneas con `ERROR` o `❌`
   - Leer el traceback completo

4. **Usar el script de testing automático**
   ```bash
   python backend/scripts/test_driver_registration.py \
       --url http://localhost:8000 \
       --org-id YOUR_ORG_ID
   ```

5. **Contactar a soporte con:**
   - Error exacto recibido
   - JSON que enviaste (sin datos sensibles)
   - Logs del servidor
   - Request ID (si está disponible)

---

## 📚 Documentación Completa

Para más detalles:
- [DEBUG_REGISTRO_CHOFER.md](DEBUG_REGISTRO_CHOFER.md) - Documentación completa
- [RESUMEN_SOLUCION_ERROR_400.md](RESUMEN_SOLUCION_ERROR_400.md) - Resumen técnico

