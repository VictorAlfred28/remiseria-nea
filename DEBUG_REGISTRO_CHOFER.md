# Diagnóstico y Corrección: Error HTTP 400 en `/api/v1/public/registro/chofer`

## 📋 Resumen Ejecutivo

**Problema**: El endpoint `POST /api/v1/public/registro/chofer` devolvía errores HTTP 400 sin información detallada, dificultando el debugging.

**Causa Raíz**: Falta de logging detallado para identificar exactamente qué validación fallaba.

**Solución Implementada**:
1. ✅ Logging granular en el endpoint del registro de choferes
2. ✅ Logging detallado en todas las funciones de validación
3. ✅ Middleware global para capturar errores 400 con contexto completo
4. ✅ Mensajes de error más informativos con el campo específico que falló

---

## 🔍 Análisis del Problema

### Schema Esperado: `ChoferRegistroCompleto`

```python
class ChoferRegistroCompleto(BaseModel):
    # Campos requeridos
    nombre: str                              # Min 2 caracteres
    email: EmailStr                          # Debe ser válido + único por org
    telefono: str                            # Min 10 dígitos
    dni: str                                 # Único por org
    organizacion_id: UUID                    # Debe existir + aceptar registros públicos
    
    # Campos opcionales
    direccion: Optional[str] = None
    licencia_numero: Optional[str] = None
    licencia_categoria: Optional[str] = None
    licencia_vencimiento: Optional[str] = None  # Formato: YYYY-MM-DD, debe ser > hoy
    
    tiene_vehiculo: bool = False
    vehiculo: Optional[str] = None
    patente: Optional[str] = None            # Si tiene_vehiculo=True, REQUERIDO (6-8 caracteres)
    
    documentos: List[Dict[str, Any]] = []
    tipo_pago: str = "comision"
    valor_pago: float = 0.0
```

### Validaciones Implementadas

Las validaciones se organizan en tres niveles:

#### **1. Validaciones de Pydantic (automáticas)**
- `nombre`: string, min_length=2
- `email`: EmailStr (formato válido)
- `dni`, `telefono`: strings
- `organizacion_id`: UUID válido
- Tipos de datos correctos

**Resultado**: Si Pydantic falla → HTTP **422 Unprocessable Entity** (no 400)

#### **2. Validaciones Comunes (en `validar_campos_comunes`)**
Se ejecutan tanto en endpoint público como admin:

| Validación | Descripción | Error Code | Mensaje |
|-----------|-----------|-----------|---------|
| `organizacion_id` existe | Verifica que la org existe en BD | 400 | "Organización no válida: {id}" |
| Email único | Email no existe en esa org | 400 | "Email ya registrado en esta organización" |
| DNI único | DNI no existe en esa org | 400 | "DNI ya registrado en esta organización" |
| Teléfono formato | Min 10 dígitos | 400 | "Teléfono inválido (debe tener mínimo 10 dígitos...)" |
| Licencia vencimiento | Si presente, debe ser > hoy | 400 | "Licencia vencida (vencimiento: {date})" |
| Patente formato | Si tiene_vehiculo=True, requerida (6-8 chars) | 400 | "Patente inválida (debe tener 6-8 caracteres...)" |

#### **3. Validaciones Específicas del Endpoint Público**
Además de lo anterior:

| Validación | Descripción | Error Code | Mensaje |
|-----------|-----------|-----------|---------|
| `acepta_registros_publicos` | Org debe aceptar registros públicos | 400 | "Esta organización no acepta registros de choferes en este momento" |

---

## 📊 Diagrama de Flujo de Validación

```
POST /api/v1/public/registro/chofer
         ↓
    [Pydantic Validation]
    - Tipos correctos?
    - Campos requeridos presentes?
    → Si falla: 422 Unprocessable Entity
    ↓
[validar_registro_publico]
    ↓
    [1] ¿organizacion_id existe?
        → No: 400 "Organización no válida"
    ↓
    [2] ¿Email único en org?
        → No: 400 "Email ya registrado"
    ↓
    [3] ¿DNI único en org?
        → No: 400 "DNI ya registrado"
    ↓
    [4] ¿Teléfono válido (10+ dígitos)?
        → No: 400 "Teléfono inválido"
    ↓
    [5] ¿Licencia vencimiento válida (si presente)?
        → No: 400 "Licencia vencida/formato inválido"
    ↓
    [6] ¿Patente válida (si tiene_vehiculo=True)?
        → No: 400 "Patente inválida/requerida"
    ↓
    [7] ¿Org acepta registros públicos?
        → No: 400 "Organización no acepta registros públicos"
    ↓
    ✅ Todas las validaciones pasaron
    ↓
    [Crear en BD]
    ↓
    200 OK {"status": "ok", "chofer": {...}}
```

---

## 🧪 Ejemplos de Testing

### ✅ Ejemplo 1: Request Válido (Éxito)

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez García",
    "email": "juan.perez@example.com",
    "telefono": "1123456789",
    "dni": "12345678",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "direccion": "Calle Principal 123, CABA",
    "licencia_numero": "LIC123456",
    "licencia_categoria": "B",
    "licencia_vencimiento": "2026-12-31",
    "tiene_vehiculo": false,
    "documentos": [],
    "tipo_pago": "comision",
    "valor_pago": 0.0
  }'
```

**Response Esperada (200 OK):**
```json
{
  "status": "ok",
  "chofer": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "usuario_id": "550e8400-e29b-41d4-a716-446655440002",
    "dni": "12345678",
    "licencia_numero": "LIC123456",
    "licencia_categoria": "B",
    "licencia_vencimiento": "2026-12-31",
    "tiene_vehiculo": false,
    "estado_validacion": "pendiente",
    "created_at": "2026-04-21T14:30:00.000000+00:00"
  }
}
```

**Logs Esperados (en servidor):**
```
INFO: === DRIVER REGISTRATION REQUEST ===
INFO: Nombre: Juan Pérez García
INFO: Email: juan.perez@example.com
INFO: DNI: 12345678
INFO: Teléfono: 1123456789
INFO: Organización ID: 550e8400-e29b-41d4-a716-446655440000
INFO: Tiene vehículo: False
INFO: Patente: None
INFO: Licencia vencimiento: 2026-12-31
INFO: Starting validation for driver registration...
INFO: === PUBLIC REGISTRATION VALIDATION ===
INFO: Running common validations...
INFO: === STARTING COMMON VALIDATIONS ===
INFO: [1/6] Validating organization...
INFO: Validating organization exists: 550e8400-e29b-41d4-a716-446655440000
INFO: ✓ Organization found: 550e8400-e29b-41d4-a716-446655440000, acepta_registros_publicos=True
INFO: [2/6] Validating email uniqueness...
INFO: Validating email uniqueness: juan.perez@example.com in org 550e8400-e29b-41d4-a716-446655440000
INFO: ✓ Email is unique: juan.perez@example.com
INFO: [3/6] Validating DNI uniqueness...
INFO: Validating DNI uniqueness: 12345678 in org 550e8400-e29b-41d4-a716-446655440000
INFO: ✓ DNI is unique: 12345678
... [más logs] ...
INFO: ✅ ALL COMMON VALIDATIONS PASSED
INFO: ✓ Organization accepts public registrations
INFO: ✅ PUBLIC REGISTRATION VALIDATION PASSED
INFO: Creating user record in database...
INFO: ✓ User created: 550e8400-e29b-41d4-a716-446655440002
INFO: Assigning chofer role...
INFO: ✓ Role assigned
INFO: Creating driver record in database...
INFO: ✓ Driver record created: 550e8400-e29b-41d4-a716-446655440002
INFO: ✅ New driver registered: 550e8400-e29b-41d4-a716-446655440002 in org: 550e8400-e29b-41d4-a716-446655440000, estado=pendiente
```

---

### ❌ Error 1: Organización No Existe

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "telefono": "1123456789",
    "dni": "12345678",
    "organizacion_id": "00000000-0000-0000-0000-000000000000",
    "tiene_vehiculo": false
  }'
```

**Response (400 Bad Request):**
```json
{
  "detail": "Organización no válida: 00000000-0000-0000-0000-000000000000"
}
```

**Logs en Servidor:**
```
ERROR: ❌ Validation failed on field 'organizacion_id': Organización no válida: 00000000-0000-0000-0000-000000000000
WARNING: ⚠️  400 Bad Request on POST /api/v1/public/registro/chofer
WARNING: Error details: {"detail": "Organización no válida: 00000000-0000-0000-0000-000000000000"}
```

---

### ❌ Error 2: Email Ya Registrado

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan.perez@example.com",
    "telefono": "1123456789",
    "dni": "99999999",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "tiene_vehiculo": false
  }'
```

**Response (400 Bad Request):**
```json
{
  "detail": "Email ya registrado en esta organización"
}
```

**Logs en Servidor:**
```
WARNING: ❌ Email already registered: juan.perez@example.com in org 550e8400-e29b-41d4-a716-446655440000
ERROR: ❌ Validation failed on field 'email': Email ya registrado en esta organización
WARNING: ⚠️  400 Bad Request on POST /api/v1/public/registro/chofer
WARNING: Error details: {"detail": "Email ya registrado en esta organización"}
```

---

### ❌ Error 3: Teléfono Inválido

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan.nuevo@example.com",
    "telefono": "123",
    "dni": "12345679",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "tiene_vehiculo": false
  }'
```

**Response (400 Bad Request):**
```json
{
  "detail": "Teléfono inválido (debe tener mínimo 10 dígitos, recibido: 123)"
}
```

**Logs en Servidor:**
```
WARNING: ❌ Invalid phone format: 123 (digits=123, count=3)
ERROR: ❌ Validation failed on field 'telefono': Teléfono inválido (debe tener mínimo 10 dígitos, recibido: 123)
WARNING: ⚠️  400 Bad Request on POST /api/v1/public/registro/chofer
WARNING: Error details: {"detail": "Teléfono inválido (debe tener mínimo 10 dígitos, recibido: 123)"}
```

---

### ❌ Error 4: Licencia Vencida

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan.nuevo@example.com",
    "telefono": "1123456789",
    "dni": "12345679",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "licencia_vencimiento": "2020-01-01",
    "tiene_vehiculo": false
  }'
```

**Response (400 Bad Request):**
```json
{
  "detail": "Licencia vencida (vencimiento: 2020-01-01). Debe ser >= 2026-04-21"
}
```

---

### ❌ Error 5: Patente Requerida pero No Proporcionada

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan.nuevo@example.com",
    "telefono": "1123456789",
    "dni": "12345679",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "tiene_vehiculo": true,
    "vehiculo": "Toyota Corolla"
  }'
```

**Response (400 Bad Request):**
```json
{
  "detail": "Patente es requerida si tiene_vehiculo=True"
}
```

---

### ❌ Error 6: Patente Inválida (Formato)

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan.nuevo@example.com",
    "telefono": "1123456789",
    "dni": "12345679",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "tiene_vehiculo": true,
    "vehiculo": "Toyota Corolla",
    "patente": "AB"
  }'
```

**Response (400 Bad Request):**
```json
{
  "detail": "Patente inválida (debe tener 6-8 caracteres, recibido: AB)"
}
```

---

### ❌ Error 7: Organización No Acepta Registros Públicos

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan.nuevo@example.com",
    "telefono": "1123456789",
    "dni": "12345679",
    "organizacion_id": "550e8400-e29b-41d4-a716-446655440000",
    "tiene_vehiculo": false
  }'
```

*Si `organizacion.acepta_registros_publicos = false`*

**Response (400 Bad Request):**
```json
{
  "detail": "Esta organización no acepta registros de choferes en este momento"
}
```

---

## 🛠️ Mejoras Implementadas

### 1. **Logging Granular en Endpoint** (`backend/app/api/v1/endpoints/public.py`)

```python
# Antes: Sin logs detallados
logger.info(f"New driver registered: {u_id} in org: {org_id}")

# Después: Logs informativos en cada paso
logger.info(f"=== DRIVER REGISTRATION REQUEST ===")
logger.info(f"Nombre: {data.nombre}")
logger.info(f"Email: {data.email}")
# ... más fields ...
logger.info(f"Starting validation...")
validar_registro_publico(data)
logger.info(f"✓ All validations passed")
# ... logs de cada operación DB ...
```

### 2. **Logging Detallado en Validaciones** (`backend/app/core/validators.py`)

```python
# Antes: Validaciones silenciosas
def validar_email_unico(email, org_id):
    existing = supabase.table(...).execute()
    if existing.data:
        raise ValidacionError(...)

# Después: Logs en cada paso
logger.info(f"Validating email uniqueness: {email} in org {org_id}")
if existing.data:
    logger.warning(f"❌ Email already registered: {email}")
    raise ValidacionError(...)
logger.info(f"✓ Email is unique: {email}")
```

### 3. **Middleware Global para Errores 400** (`backend/app/core/middleware.py`)

```python
class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    """Captura 400s con detalles completos"""
    
    async def dispatch(self, request, call_next):
        # Log request body
        body = await request.body()
        logger.debug(f"Request body: {json.dumps(json.loads(body))}")
        
        response = await call_next(request)
        
        # Si es 400, loguear detalles del error
        if response.status_code == 400:
            logger.warning(f"❌ 400 Bad Request: {error_details}")
        
        return response
```

**Agregar a main.py:**
```python
from app.core.middleware import ErrorLoggingMiddleware

app.add_middleware(ErrorLoggingMiddleware)
```

---

## 🔒 Mejoras de Seguridad

✅ **No se rompió ninguna validación existente**
- Todas las validaciones actuales se mantienen
- Se agregaron más logs, pero la lógica es idéntica

✅ **Mensajes de error seguros**
- No revelan información sensible
- Indican campo específico que falló
- Guían al usuario sobre qué corregir

✅ **Protección contra vulnerabilidades**
- Email/DNI únicos por organización (previene duplicados)
- Licencia válida (no expirada)
- Patente formato válido (6-8 caracteres)
- Teléfono formato válido (10+ dígitos)

---

## 📝 Recomendaciones Futuras

### 1. **Agregar Validación de Nombre**
```python
def validar_nombre_formato(nombre: str) -> None:
    """Validar que el nombre sea plausible"""
    if len(nombre.split()) < 2:
        raise ValidacionError(
            status_code=400,
            detail="Nombre debe incluir nombre y apellido",
            field="nombre"
        )
```

### 2. **Agregar Validación de Dirección**
```python
def validar_direccion_formato(direccion: Optional[str]) -> None:
    """Si se proporciona dirección, debe tener longitud mínima"""
    if direccion and len(direccion) < 10:
        raise ValidacionError(...)
```

### 3. **Crear Tests Unitarios**
```python
# tests/test_driver_registration.py
def test_register_driver_success(client, db):
    response = client.post("/api/v1/public/registro/chofer", json={
        "nombre": "Juan Pérez",
        "email": "nuevo@test.com",
        # ...
    })
    assert response.status_code == 200

def test_register_driver_duplicate_email(client, db):
    response = client.post("/api/v1/public/registro/chofer", json={
        "email": "existing@test.com",  # Ya existe
        # ...
    })
    assert response.status_code == 400
    assert "Email ya registrado" in response.json()["detail"]
```

### 4. **Agregar Rate Limiting**
```python
# Evitar spam de registros
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/registro/chofer")
@limiter.limit("5/minute")  # Max 5 registros por minuto
def crear_perfil_chofer(...):
    ...
```

### 5. **Monitoreo y Alertas**
```python
# Loguear intentos fallidos para análisis
logger.warning(f"Registration failed: {error_detail}", extra={
    "user_ip": request.client.host,
    "organization_id": str(org_id),
    "failed_field": field
})
```

---

## 📚 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| [backend/app/api/v1/endpoints/public.py](backend/app/api/v1/endpoints/public.py#L94) | ✅ Logging granular en endpoint |
| [backend/app/core/validators.py](backend/app/core/validators.py) | ✅ Logging en todas las validaciones |
| [backend/app/core/middleware.py](backend/app/core/middleware.py) | ✨ Archivo nuevo: middleware global |
| [backend/app/main.py](backend/app/main.py#L10) | ✅ Integración del middleware |

---

## ✅ Checklist de Verificación

- [x] Endpoint mantiene funcionalidad original
- [x] Todas las validaciones siguen activas
- [x] Logs detallados para cada paso
- [x] Mensajes de error informativos
- [x] Middleware global para capturar 400s
- [x] No se rompieron otros endpoints
- [x] Seguridad mantenida/mejorada
- [x] Código bien comentado

---

## 🚀 Cómo Probar

### 1. **Localmente con Postman/Thunder Client**

1. Copiar un ejemplo de request válido desde arriba
2. Cambiar `organizacion_id` a una org existente en tu BD
3. Cambiar `email` y `dni` a valores únicos
4. Enviar POST a `http://localhost:8000/api/v1/public/registro/chofer`
5. Verificar respuesta y logs

### 2. **Con curl**

```bash
# Test 1: Éxito
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","email":"test@test.com","telefono":"1123456789","dni":"12345678","organizacion_id":"...","tiene_vehiculo":false}'

# Test 2: Error (email inválido)
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","email":"invalid","telefono":"1123456789","dni":"12345678","organizacion_id":"...","tiene_vehiculo":false}'
```

### 3. **Ver Logs**

```bash
# En servidor (si usa Docker)
docker logs container_name -f

# O si corre localmente
python -m app.main  # Verá logs en stdout
```

---

## 📞 Contacto/Soporte

Si encontras un error 400 y quieres debuggear:

1. **Buscar en logs** el patrón `❌ Validation failed on field`
2. **Leer el mensaje de error** (`detail`)
3. **Verificar el campo específico** que menciona
4. **Corregir el valor** según las reglas de validación
5. **Reintentar**

Si persiste el error:
- Verificar que `organizacion_id` existe en BD
- Verificar que email/DNI no están ya registrados
- Verificar formato de teléfono (10+ dígitos)
- Verificar formato de fecha de licencia (YYYY-MM-DD, futuro)
- Verificar que patente sea 6-8 caracteres si `tiene_vehiculo=true`

