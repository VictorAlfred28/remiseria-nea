## 📋 SQL BACKUP COMPLETO - GUÍA DE USO

**Archivo Principal:** `SQL_BACKUP_COMPLETO_PRODUCCION.sql`

---

## 🎯 ¿QUÉ CONTIENE?

Este script SQL es el **dump completo** de toda la base de datos de Remisería NEA:

```
✅ Extensiones (UUID, PostGIS, PostGIS Topology)
✅ Funciones Custom (Auth helpers, Geolocation)
✅ 27 Tablas principales con:
   - Row Level Security (RLS) habilitado
   - Políticas de seguridad multi-tenant
   - Índices para performance
   - Constraints e UNIQUE keys
   - Comments para documentación
✅ Storage Buckets (comprobantes, fotos, documentos, logos)
✅ Constraints de seguridad adicionales
```

---

## 🚀 CÓMO USARLO

### OPCIÓN 1: Restaurar en Supabase (RECOMENDADO)

1. **Ir a Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Seleccionar tu proyecto

2. **Abrir SQL Editor**
   - Click en "SQL Editor" (sidebar izquierdo)
   - Click en "New Query" o "+" button

3. **Copiar y Pegar**
   - Abrir archivo: `SQL_BACKUP_COMPLETO_PRODUCCION.sql`
   - Seleccionar TODO el contenido (Ctrl+A)
   - Copiar (Ctrl+C)
   - Pegar en Supabase SQL Editor (Ctrl+V)

4. **Ejecutar**
   - Click en botón "Run" (esquina superior derecha)
   - O presionar Ctrl+Enter
   - Esperar a que complete (toma ~30-60 segundos)

5. **Verificar Resultado**
   - Debería mostrar lista de todas las tablas
   - Revisar que NO haya errores en rojo
   - Si hay conflictos, usar "DROP TABLE IF EXISTS" antes

### OPCIÓN 2: Restaurar en PostgreSQL Local

```bash
# Usando psql (línea de comandos)
psql -h localhost -U postgres -d remiseria_nea < SQL_BACKUP_COMPLETO_PRODUCCION.sql

# O sin especificar host (conecta a localhost por defecto)
psql -U postgres -d remiseria_nea -f SQL_BACKUP_COMPLETO_PRODUCCION.sql

# O desde pgAdmin:
# - Clic derecho en Database
# - "Restore"
# - Seleccionar archivo SQL
```

### OPCIÓN 3: Restaurar en Otra Instancia Supabase

```bash
# 1. Obtener connection string de la nueva instancia
# En Supabase Dashboard → Settings → Database

# 2. Usar psql con el connection string
psql "postgres://user:password@host:5432/postgres" < SQL_BACKUP_COMPLETO_PRODUCCION.sql

# O con variables de entorno
export DATABASE_URL="postgres://user:password@host:5432/postgres"
psql $DATABASE_URL < SQL_BACKUP_COMPLETO_PRODUCCION.sql
```

---

## ⚠️ PRECAUCIONES IMPORTANTES

### Antes de ejecutar:

1. **Backup actual**
   ```bash
   # Si tienes base de datos existente, hacer backup primero
   pg_dump -h host -U user -d database > backup_antes.sql
   ```

2. **Limpiar tablespace** (si migras a vacío)
   - Si la BD destino está vacía, el script se ejecutará sin conflictos
   - Si tiene datos, SQL creará tablas adicionales (puede haber duplicados)

3. **Verificar permisos**
   - Usuario debe tener permisos de CREACIÓN DE TABLAS
   - En Supabase: automático (eres admin)
   - En PostgreSQL local: `GRANT ALL PRIVILEGES ON DATABASE database TO user;`

### Errores comunes y soluciones:

| Error | Causa | Solución |
|-------|-------|----------|
| `Extension "uuid-ossp" already exists` | Extensión ya existe | SQL usa `CREATE EXTENSION IF NOT EXISTS` - sin problema |
| `Relation "tabla" already exists` | Tabla duplicada | SQL usa `CREATE TABLE IF NOT EXISTS` - sin problema |
| `Permission denied` | Permisos insuficientes | Conectar con admin/superuser |
| `FATAL: database "xxx" does not exist` | BD no existe | Crearla primero: `CREATE DATABASE xxx;` |

---

## 📊 ESTRUCTURA DE DATOS

### Tablas Principales

**Multi-tenant Base:**
- `organizaciones` - Contenedor de clientes
- `usuarios` - Perfiles de usuario (linked a Auth)
- `choferes` - Detalle de choferes

**Core Business:**
- `viajes` - Registro de viajes (origin/destino en JSONB)
- `calificaciones` - Sistema de ratings 1-5 estrellas
- `empresas` - Empresas cliente para viajes corporativos

**Flota y Reservas:**
- `vehicles` - Registro de vehículos con titulares
- `reservations` - Reservas de viajes anticipados

**Sistema de Puntos:**
- `historial_puntos` - Log de acumulación/canje

**Pagos:**
- `pagos_chofer` - Solicitudes manuales de pago
- `cuenta_corriente_empresas` - Ledger de empresas

**Tarifas:**
- `tariff_configs` - Configuración de precios
- `tariff_history` - Auditoría de cambios
- `tariff_branding` - Branding visual

**Job Board:**
- `bolsa_empleos` - Ofertas de trabajo
- `bolsa_postulaciones` - Aplicaciones de choferes

**Afiliados:**
- `comercios` - Negocios asociados
- `comercio_solicitudes` - Solicitudes de afiliación
- `historial_escaneos_socios` - Tracking de descuentos

**Otros:**
- `promociones` - Promociones y ofertas
- `conversation_state` - Estado para WhatsApp bot

---

## 🔐 SEGURIDAD

### Row Level Security (RLS)

Todas las tablas multi-tenant están protegidas con RLS:

- **Usuarios solo ven su org** (excepto superadmin)
- **Actualizaciones limitadas** (solo tu propio perfil)
- **Admin ve todo de su org** (no puede ver otras)
- **Superadmin ve everything** (acceso total)

### Funciones Security:

- `get_auth_orga_id()` - Extrae org_id del JWT
- `get_auth_rol()` - Extrae rol del JWT

### Storage Buckets:

- `comprobantes` - Público (fotos de pagos)
- `profile-photos` - Público
- `documentos` - Privado
- `comercios-logos` - Público

---

## 🔄 MIGRACIONES Y VERSIONING

### Cómo actualizar el script:

1. **Si cambias schema**
   ```sql
   ALTER TABLE usuarios ADD COLUMN nuevo_campo TEXT;
   ```

2. **Si creas nueva tabla**
   ```sql
   CREATE TABLE nueva_tabla (...);
   ALTER TABLE nueva_tabla ENABLE ROW LEVEL SECURITY;
   -- Agregar políticas
   ```

3. **Actualizar SQL_BACKUP_COMPLETO_PRODUCCION.sql**
   - Agregar el nuevo SQL al final (antes de VERIFICACIÓN FINAL)
   - Subir a GitHub con commit descriptivo

### Versionado sugerido:

```
v1.0 (2026-04-20) - Schema inicial
v1.1 (2026-04-21) - Agregar tabla X
v1.2 (2026-04-25) - Fix en RLS de tabla Y
```

---

## 📈 PERFORMANCE

### Índices Creados:

- Cada tabla multi-tenant tiene índice en `organizacion_id`
- Tablas con búsqueda frecuente tienen índices en campos clave
- Única constraint en tarifas activas por org

**Consultas típicas rápidas (<100ms):**
```sql
-- Viajes de un cliente
SELECT * FROM viajes WHERE cliente_id = ... AND organizacion_id = ...;

-- Viajes cercanos (con PostGIS)
SELECT * FROM get_viajes_cercanos(lat, lng, 10);

-- Calificaciones de un chofer
SELECT * FROM calificaciones WHERE chofer_id = ...;
```

---

## 🆘 TROUBLESHOOTING

### Script no completa:

1. **Verificar límite de memoria**
   - Script es ~150KB - no debe ser problema

2. **Ver logs de error**
   - En Supabase: Logs → Database Logs
   - En psql: Revisar output

3. **Ejecutar por partes**
   - Copiar cada PARTE (entre comentarios) por separado
   - Identificar cuál falla

### RLS no funciona después:

```sql
-- Verificar que esté habilitado
SELECT tablename, schemaname 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'usuarios';

-- Ver políticas
SELECT * FROM pg_policies WHERE tablename = 'usuarios';

-- Si falta, habilitar:
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
```

### JWT claims no se leen:

```sql
-- Verificar JWT en sesión
SELECT current_setting('request.jwt.claims');

-- Debe retornar algo como:
-- {"sub":"uuid","role":"authenticated","organizacion_id":"uuid",...}
```

---

## 📝 CHECKLIST DE VERIFICACIÓN

Después de ejecutar el script:

- [ ] Todas las extensiones creadas (uuid-ossp, postgis)
- [ ] 27 tablas creadas
- [ ] RLS habilitado en todas las tablas
- [ ] Al menos 60 políticas RLS creadas
- [ ] 3 funciones custom creadas
- [ ] 4 Storage buckets creados
- [ ] No hay errores en rojo
- [ ] `pg_tables` muestra todas las tablas
- [ ] `pg_policies` muestra todas las políticas

---

## 🔗 RECURSOS ADICIONALES

- **Documentación Supabase:** https://supabase.com/docs
- **PostgreSQL RLS:** https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **PostGIS:** https://postgis.net/documentation/
- **Este proyecto:** https://github.com/VictorAlfred28/remiseria-nea

---

## ⏰ SOPORTE

Si algo no funciona:

1. **Revisar los logs** (Supabase Dashboard → Logs)
2. **Probar comando simple**
   ```sql
   SELECT * FROM pg_tables WHERE schemaname = 'public';
   ```
3. **Contactar soporte** con error exacto

---

**Script creado:** 2026-04-20  
**Versión:** 1.0  
**Tamaño:** ~150KB  
**Tiempo estimado:** 30-60 segundos
