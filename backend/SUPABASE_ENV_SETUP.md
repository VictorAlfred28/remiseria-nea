# Configuración de Variables de Entorno - Fase 4

Para ejecutar el test E2E contra Supabase REAL, necesitas proporcionar:

1. **SUPABASE_URL**: URL de tu proyecto Supabase
   - Formato: `https://xxxxxxxxxxxxxx.supabase.co`
   - Encontrar en: Supabase Dashboard → Project Settings → API → URL

2. **SUPABASE_SERVICE_ROLE_KEY**: Key de administrador (no la pública)
   - Formato: `eyJhbGc...` (JWT token largo)
   - Encontrar en: Supabase Dashboard → Project Settings → API → Service Role Secret
   - ⚠️ IMPORTANTE: Esta es la key de ADMIN - mantenerla segura

## Opción A: Exportar en Terminal (Recomendado)

```bash
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
python backend/scripts/test_e2e_fase4_supabase.py
```

## Opción B: Crear archivo `.env` en backend/

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Luego ejecutar:
```bash
cd backend
python scripts/test_e2e_fase4_supabase.py
```

## Qué Hace el Test

1. ✅ Crea una org de prueba
2. ✅ Registra un chofer públicamente (estado='pendiente')
3. ✅ Aprueba el chofer como admin (estado='aprobado')
4. ✅ Valida UNIQUE constraints (email, DNI)
5. ✅ Valida RLS policies (Row Level Security)
6. ✅ Limpia todos los datos de prueba al final

## Seguridad

- ⚠️ Nunca commitees las credenciales a git
- ⚠️ Use `.env` solo localmente o en CI/CD securo
- ⚠️ Rotate la SERVICE_ROLE_KEY después de testing en producción
