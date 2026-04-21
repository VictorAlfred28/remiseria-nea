# 📋 FASE 3: UNIFICACIÓN DE FORMULARIOS - AUDITORÍA Y PLAN

## 1. ESTADO ACTUAL - DESALINEACIÓN CRÍTICA

### RegisterChofer.tsx (App - Frontend)

**Estructura (4 pasos):**
```
Paso 1: Datos Personales
├─ nombre (string, required)
├─ email (email, required)
├─ telefono (string, required)
├─ direccion (string, required)
└─ password (string, required, >6 chars)

Paso 2: Licencia
├─ licencia_numero (string, required)
├─ licencia_categoria (select: D1|D2|B1|Otra, default D1)
└─ licencia_vencimiento (date, required, > today)

Paso 3: Documentación (Upload Storage)
├─ frente_licencia (file, JPG/PNG, required)
├─ dorso_licencia (file, JPG/PNG, required)
└─ certificado_antecedentes (file, JPG/PNG, required)

Paso 4: Vehículo
├─ tieneVehiculo (checkbox, default true)
├─ vehiculoMarcaModelo (string, required si tieneVehiculo=true)
└─ patente (string, required si tieneVehiculo=true, uppercase)
```

**Payload final enviado a `/public/registro/chofer`:**
```json
{
  "id": "auth.uid()",
  "organizacion_id": "default",
  "email": "user@example.com",
  "nombre": "Juan Pérez",
  "telefono": "3794123456",
  "direccion": "Av Test 123",
  "vehiculo": "Toyota Prius 2020",
  "patente": "AB123CD",
  "licencia_numero": "30123456",
  "licencia_categoria": "D1",
  "licencia_vencimiento": "2030-12-31",
  "documentos": [
    {"title": "frente", "url": "...", "fileName": "..."},
    {"title": "dorso", "url": "...", "fileName": "..."},
    {"title": "antecedentes", "url": "...", "fileName": "..."}
  ],
  "tiene_vehiculo": true
}
```

**Campos FALTANTES:**
- ❌ dni
- ❌ tipo_pago
- ❌ valor_pago

---

### AdminDashboard.tsx (Panel Admin - Frontend)

**Estructura (1 formulario):**
```
Alta Especializada
├─ nombre (input, required)
├─ telefono (input, required)
├─ email (input, required)
├─ dni (input, required)
├─ vehiculo (input, required)
├─ patente (input, required, uppercase)
├─ tipo_pago (select: comision|base)
└─ valor_pago (number, required)
```

**Payload enviado a `/admin/chofer`:**
```json
{
  "nombre": "Juan Pérez",
  "email": "chofer@example.com",
  "telefono": "3794123456",
  "vehiculo": "Toyota Prius",
  "patente": "AB123CD",
  "dni": "30555666",
  "tipo_pago": "comision",
  "valor_pago": 25.0
}
```

**Campos FALTANTES:**
- ❌ licencia_numero
- ❌ licencia_categoria
- ❌ licencia_vencimiento
- ❌ documentos (archivos)
- ❌ direccion
- ❌ tiene_vehiculo (siempre asume true)

---

### Backend: admin.py (ChoferCreate DTO)

```python
class ChoferCreate(BaseModel):
    nombre: str
    email: EmailStr
    telefono: str
    vehiculo: str
    patente: str
    dni: str
    tipo_pago: str = "comision"
    valor_pago: float = 0.0
```

**Estado actual:**
- ✅ Recibe: nombre, email, telefono, vehiculo, patente, dni, tipo_pago, valor_pago
- ❌ NO recibe: licencia_numero, licencia_categoria, licencia_vencimiento
- ❌ NO recibe: documentos
- ❌ NO recibe: direccion
- ❌ NO recibe: tiene_vehiculo

---

## 2. TABLA COMPARATIVA DETALLADA

| Campo | App | Admin | Backend DTO | Estado BD |
|-------|-----|-------|------------|-----------|
| **PERSONALES** | | | | |
| nombre | ✅ | ✅ | ✅ | ✅ |
| email | ✅ | ✅ | ✅ | ✅ |
| telefono | ✅ | ✅ | ✅ | ✅ |
| direccion | ✅ | ❌ | ❌ | ✅ (en usuarios tabla) |
| password | ✅ | ❌ (auto-gen) | ❌ | N/A (auth) |
| **DOCUMENTO** | | | | |
| dni | ❌ | ✅ | ✅ | ✅ |
| **LICENCIA** | | | | |
| licencia_numero | ✅ | ❌ | ❌ | ✅ |
| licencia_categoria | ✅ | ❌ | ❌ | ✅ |
| licencia_vencimiento | ✅ | ❌ | ❌ | ✅ |
| **VEHÍCULO** | | | | |
| tiene_vehiculo | ✅ | ❌ | ❌ | ✅ |
| vehiculo (marca/modelo) | ✅ | ✅ | ✅ | ✅ |
| patente | ✅ | ✅ | ✅ | ✅ |
| **PAGO** | | | | |
| tipo_pago | ❌ | ✅ | ✅ | ✅ |
| valor_pago | ❌ | ✅ | ✅ | ✅ |
| **DOCUMENTACIÓN** | | | | |
| documentos (archivos) | ✅ | ❌ | ❌ | ✅ |
| estado_validacion | ✅ (pendiente) | ✅ (aprobado) | ❌ | ✅ |
| **DIFERENCIAS DE ORDEN** | 14 campos | 10 campos | 8 campos | - |

---

## 3. PROBLEMAS IDENTIFICADOS

### 🔴 CRÍTICOS

1. **DNI: App no recoge, Admin sí**
   - App asume que será llenado luego por Admin?
   - ❌ Inconsistencia: DNI debe ser REQUERIDO en ambos
   - 🚨 Riesgo: Chofer registrado sin DNI, admin lo crea sin poder verificar

2. **Licencia: App recoge, Admin NO**
   - Admin no puede ver/verificar licencia
   - App carga docs pero Admin no tiene visibilidad
   - 🚨 Riesgo: Admin aprueba sin ver documentación

3. **Pago: App no recoge, Admin sí**
   - App asume que Admin configurará pagos?
   - ❌ Campo crítico para negocio faltante en app
   - 🚨 Riesgo: Chofer registra sin saber términos de pago

4. **Documentos: App carga, Admin no ve**
   - App sube a storage pero ¿Admin dónde los ve?
   - Admin no tiene access ni visibilidad
   - 🚨 Riesgo: Admin aprueba sin verificar antecedentes

### 🟠 ALTOS

5. **Direccion: App recoge, Admin NO**
   - Campo útil pero inconsistente
   - Almacenado en `usuarios` tabla, no `choferes`

6. **Tiene_vehiculo: App lo maneja, Admin asume true**
   - Si chofer no tiene vehículo, Admin no puede marcar
   - Job board necesita saber si busca vehículo

7. **Estado validacion: diferente en ambos flujos**
   - App registra: `pendiente`
   - Admin registra: `aprobado`
   - ✅ Esto es correcto (distintos flujos)

---

## 4. SOLUCIÓN: DTO UNIFICADO

### ChoferRegistroCompleto (Backend)

```python
class ChoferRegistroCompleto(BaseModel):
    """
    DTO único para AMBOS flujos:
    - Registro público (app): campos requeridos + documentos
    - Alta admin: campos requeridos + pago
    """
    
    # ============================================================
    # SECCIÓN 1: DATOS PERSONALES (AMBOS - REQUERIDO)
    # ============================================================
    nombre: str  # [3-100 chars]
    email: EmailStr  # Único global
    telefono: str  # [7-15 dígitos]
    direccion: Optional[str] = None  # Admin no siempre lo tiene
    
    # ============================================================
    # SECCIÓN 2: DOCUMENTO (AMBOS - REQUERIDO)
    # ============================================================
    dni: str  # Único por organización
    
    # ============================================================
    # SECCIÓN 3: LICENCIA (APP PRINCIPALMENTE)
    # ============================================================
    licencia_numero: Optional[str] = None
    licencia_categoria: Optional[str] = None  # D1, D2, B1, Otra
    licencia_vencimiento: Optional[str] = None  # ISO date
    
    # ============================================================
    # SECCIÓN 4: VEHÍCULO (AMBOS)
    # ============================================================
    tiene_vehiculo: bool = True
    vehiculo: Optional[str] = None  # Marca/modelo O "Busca vehículo"
    patente: Optional[str] = None  # Uppercase
    
    # ============================================================
    # SECCIÓN 5: PAGO (ADMIN PRINCIPALMENTE)
    # ============================================================
    tipo_pago: str = "comision"  # comision|base
    valor_pago: float = 0.0
    
    # ============================================================
    # SECCIÓN 6: DOCUMENTACIÓN (APP PRINCIPALMENTE - BACKEND ONLY)
    # ============================================================
    documentos: List[Dict[str, str]] = []  # [{title, url, fileName}, ...]
    
    # ============================================================
    # SECCIÓN 7: ESTADO (BACKEND ONLY - NO en input)
    # ============================================================
    # estado_validacion calculado por endpoint, no por usuario
    # estado_validacion: str = "pendiente"  # NO recibir, calcular

class ChoferRegistroResponse(BaseModel):
    id: str
    nombre: str
    email: str
    password_temporal: Optional[str] = None  # Solo si creado por admin
    estado_validacion: str
    creado_en: datetime
```

---

## 5. PLAN DE IMPLEMENTACIÓN

### FASE 3.1: Backend - Crear DTO unificado

**Archivos a modificar:**
- `backend/app/schemas/domain.py` - Actualizar `Chofer` + crear `ChoferRegistroCompleto`

**Cambios:**
```python
# Agregar DTO nuevo
class ChoferRegistroCompleto(BaseModel):
    # ... (ver arriba)

# Actualizar Chofer para incluir nuevos campos
class Chofer(BaseModel):
    # ... incluir licencia_*, tiene_vehiculo, documentos
```

**Sin cambios en BD** (ya están las columnas de Fase 1-2)

---

### FASE 3.2: Backend - Unificar endpoints

**Archivos a modificar:**
- `backend/app/api/v1/endpoints/public.py` - POST `/registro/chofer`
- `backend/app/api/v1/endpoints/admin.py` - POST `/chofer`

**Cambios:**

```python
# public.py
@router.post("/registro/chofer")
def crear_perfil_chofer(req: ChoferRegistroCompleto):  # ← Nuevo DTO
    # Backend calcula: estado_validacion = "pendiente"
    # App proporciona: licencia_*, documentos
    # Admin proporciona: tipo_pago, valor_pago (opcionales aquí)
    ...

# admin.py
@router.post("/chofer")
def create_chofer(data: ChoferRegistroCompleto):  # ← Mismo DTO
    # Backend calcula: estado_validacion = "aprobado"
    # Admin proporciona: todos excepto documentos (opcional)
    # Auto-genera password
    ...
```

**Validaciones unificadas:**
- Email: RFC 5322
- Telefono: 7-15 dígitos
- DNI: unique per org
- Nombre: 3-100 chars
- Licencia vencimiento: > today (si proporcionada)
- Patente: uppercase, format

---

### FASE 3.3: Frontend App - Agregar campos

**Archivo a modificar:**
- `frontend/src/pages/RegisterChofer.tsx`

**Cambios:**

```jsx
// Agregar en Paso 1 (antes de Paso 2):
Paso 1: Datos Personales
├─ nombre ✅ (existe)
├─ email ✅ (existe)
├─ telefono ✅ (existe)
├─ direccion ✅ (existe)
├─ password ✅ (existe)
└─ dni ✅ (NUEVO - requerido)

// Renombrar Paso 2 → Paso 3
// Paso 2: Vehículo (nuevo orden)
├─ tieneVehiculo ✅ (movido)
├─ vehiculoMarcaModelo ✅ (movido)
└─ patente ✅ (movido)

// Paso 3: Licencia (renumerado)
├─ licencia_numero ✅ (existe, renumerado)
├─ licencia_categoria ✅ (existe, renumerado)
└─ licencia_vencimiento ✅ (existe, renumerado)

// Paso 4: Documentos (renumerado)
├─ frente_licencia ✅ (existe, renumerado)
├─ dorso_licencia ✅ (existe, renumerado)
└─ certificado_antecedentes ✅ (existe, renumerado)

// NO agregar: tipo_pago, valor_pago (opcional en app)
```

**Nuevo orden (5 pasos):**
1. Personales + DNI
2. Vehículo
3. Licencia
4. Documentos
5. Confirmación

---

### FASE 3.4: Frontend Admin - Agregar campos

**Archivo a modificar:**
- `frontend/src/pages/AdminDashboard.tsx` (sección Alta Especializada)

**Cambios:**

```jsx
Alta Especializada
├─ Sección 1: Datos Personales
│  ├─ nombre ✅ (existe)
│  ├─ email ✅ (existe)
│  ├─ telefono ✅ (existe)
│  └─ direccion ✅ (NUEVO - opcional)
│
├─ Sección 2: Documento
│  └─ dni ✅ (existe)
│
├─ Sección 3: Licencia (NUEVA SECCIÓN)
│  ├─ licencia_numero ✅ (NUEVO)
│  ├─ licencia_categoria ✅ (NUEVO - select)
│  └─ licencia_vencimiento ✅ (NUEVO - date)
│
├─ Sección 4: Vehículo
│  ├─ tiene_vehiculo ✅ (NUEVO - checkbox)
│  ├─ vehiculo ✅ (existe, condicional si tiene_vehiculo=true)
│  └─ patente ✅ (existe, condicional si tiene_vehiculo=true)
│
└─ Sección 5: Pago
   ├─ tipo_pago ✅ (existe)
   └─ valor_pago ✅ (existe)
```

**Validaciones igual a app:**
- Mismos formatos
- Mismos ranges
- Mismos validadores

---

### FASE 3.5: Frontend Services - Actualizar llamadas

**Archivos a modificar:**
- `frontend/src/services/api.ts`

**Cambios:**
```typescript
// Actualizar createChofer() para enviar ChoferRegistroCompleto
export const createChofer = async (data: {
    nombre: string,
    email: string,
    telefono: string,
    direccion?: string,
    dni: string,
    licencia_numero?: string,
    licencia_categoria?: string,
    licencia_vencimiento?: string,
    tiene_vehiculo: boolean,
    vehiculo?: string,
    patente?: string,
    tipo_pago?: string,
    valor_pago?: number,
    documentos?: any[]
}) => {
    const res = await api.post("/admin/chofer", data);
    return res.data;
};
```

---

## 6. RIESGOS Y MITIGACIONES

### Riesgos de Implementación

| Riesgo | Mitigación |
|--------|-----------|
| Romper API existente | ✅ Usar `if body has field` para backwards compat |
| Break frontend en deploy | ✅ Agregar campos opcionales (default values) |
| DNI duplicados en BD | ✅ Ya existe índice UNIQUE idx_choferes_dni_por_org |
| Admin no puede editar licencia | ⚠️ Separate endpoint para editar chofer (Future) |
| Documentos orphaned | ✅ Actualizar endpoint para guardar URLs en DB |

---

## 7. TIMELINE RECOMENDADO

```
FASE 3.1: Backend DTOs        → 1 hora
FASE 3.2: Backend endpoints   → 1.5 horas
FASE 3.3: Frontend App        → 1.5 horas
FASE 3.4: Frontend Admin      → 1 hora
FASE 3.5: Services update     → 0.5 horas
Testing E2E                   → 1 hora
─────────────────────────────────────
TOTAL: ~6 horas (1 sprint)
```

---

## 8. CRITERIOS DE ÉXITO

- [ ] Registro app recoge DNI + licencia + documentos
- [ ] Admin panel recoge todos los campos + licencia
- [ ] Ambos endpoints aceptan ChoferRegistroCompleto
- [ ] Validaciones idénticas en ambos
- [ ] Orden de campos coherente
- [ ] Test: App registra sin errores
- [ ] Test: Admin crea sin errores
- [ ] Test: Ambos insertan correctamente en BD
- [ ] Sin breaking changes en endpoints existentes

