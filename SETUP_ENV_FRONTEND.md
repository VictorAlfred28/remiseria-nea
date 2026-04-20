# ============================================================
# SOLUCIÓN: Error "Failed to fetch (api.supabase.com)"
# ============================================================

## 🔴 PROBLEMA

El frontend no puede conectar con Supabase porque **falta el archivo `.env`**

## ✅ SOLUCIÓN RÁPIDA

### Paso 1: Obtener Credenciales de Supabase

1. **Ir a Supabase Dashboard** → https://supabase.com/dashboard
2. **Click en tu proyecto** (remiseria-nea)
3. **Settings → API**
4. **Copiar:**
   - `Project URL` → `VITE_SUPABASE_URL`
   - `Anon Public Key` → `VITE_SUPABASE_ANON_KEY`

### Paso 2: Crear archivo `.env`

**Crear archivo:** `frontend/.env`

**Contenido:**
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=http://localhost:8000/api/v1
```

Reemplazar:
- `https://tu-proyecto.supabase.co` → Tu URL de Supabase
- `eyJhbGciOi...` → Tu Anon Key completa

### Paso 3: Reiniciar Frontend

**Terminal:**
```bash
cd frontend
npm run dev
```

---

## 📋 Referencia Completa de Variables

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | `https://hwfojkjw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anónima | `eyJhbGc...` (larga) |
| `VITE_API_URL` | URL del Backend | `http://localhost:8000/api/v1` |

### Para Desarrollo Local:
```env
VITE_SUPABASE_URL=https://hwfojkjw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=http://localhost:8000/api/v1
```

### Para Producción:
```env
VITE_SUPABASE_URL=https://hwfojkjw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=https://viajesnea.agentech.ar/api/v1
```

---

## 🔍 Verificar que Está Correcto

Después de crear `.env`:

```bash
# Terminal en frontend/
npm run dev

# En navegador, abrir: http://localhost:5173
# ✅ Debería cargar sin errores de "Failed to fetch"
```

---

## ❌ Errores Comunes

### "VITE_SUPABASE_URL is undefined"
→ Asegurarse de que está en `frontend/.env` (no en raíz)

### "Failed to fetch (api.supabase.com)"
→ VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY incorrectos

### "Cannot reach backend"
→ Verificar que backend está corriendo (`python -m uvicorn`)

---

## 📂 Ubicación Correcta

```
frontend/
├── .env                 ← AQUÍ debe estar el archivo
├── src/
├── package.json
└── vite.config.ts
```

---

## 🆘 ¿Dónde Están mis Credenciales?

1. **Login a Supabase** → https://supabase.com/dashboard
2. **Seleccionar proyecto**
3. **Settings (engranaje) → API**
4. **Ver sección "Project API keys"**

```
Project URL: https://hwfojkjw.supabase.co ← Copiar esto
Anon public key: eyJhbGciOi... ← Copiar esto
```

---

## 💡 Nota de Seguridad

- **`.env` NO debe commiterse a git** (está en `.gitignore` ✅)
- **Solo para desarrollo local**
- **En producción, usar variables de entorno del servidor**

---

**¿Necesitas ayuda para encontrar las credenciales?** 👇
