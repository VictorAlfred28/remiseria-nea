# 🗑️ Script de Limpieza de Base de Datos

## 📋 Descripción

Script SQL que **elimina TODOS los datos** de la base de datos manteniendo únicamente:
- ✅ Admin: `victoralfredo2498@gmail.com`
- ✅ Su organización asociada
- ✅ Configuración del sistema

---

## ⚠️ ADVERTENCIAS

- **DESTRUCTIVO**: Este script elimina datos permanentemente
- **NO SE PUEDE DESHACER**: No hay rollback automático
- **SOLO PARA DESARROLLO**: Usar solo en ambiente de desarrollo/testing
- **Hacer backup antes**: Crear una copia de la BD antes de ejecutar

---

## 🚀 Cómo Usar

### Opción 1: Ejecutar en Supabase Dashboard

1. **Ir a Supabase → SQL Editor**
2. **Copiar/Pegar todo el contenido de `CLEANUP_DATABASE.sql`**
3. **Click en "Run"**
4. **Esperar a que finalice (1-2 minutos)**

### Opción 2: Ejecutar con psql (desde terminal)

```bash
# Conectarse a la BD Supabase
psql "postgresql://[user]:[password]@[host]:5432/postgres"

# Ejecutar script
\i CLEANUP_DATABASE.sql
```

---

## 📊 ¿Qué se elimina?

### ✅ Se Mantiene
```
✓ usuarios:              vicoralfredo2498@gmail.com (admin)
✓ organizaciones:        Organización del admin
✓ user_roles:            Roles del admin
```

### ❌ Se Elimina
```
✗ viajes:                Todos
✗ choferes:              Todos
✗ clientes:              Excepto admin
✗ promociones:           Todas
✗ empresas:              Todas
✗ comercios:             Todos
✗ calificaciones:        Todas
✗ pagos_chofer:          Todos
✗ grupos_familiares:     Todos
✗ reservations:          Todas
✗ tarifas:               Todas
✗ carrito/chat:          Todos
✗ Historiales/Auditorías: Todos
```

---

## 🔍 Verificar Limpieza

Después de ejecutar el script:

```sql
-- Ver usuarios restantes
SELECT count(*) as total_usuarios FROM usuarios;
-- Resultado esperado: 1

-- Ver organizaciones restantes
SELECT count(*) as total_orgs FROM organizaciones;
-- Resultado esperado: 1

-- Ver que el admin existe
SELECT id, email, nombre, rol FROM usuarios;
-- Resultado: victoralfredo2498@gmail.com | admin
```

---

## 🆘 Troubleshooting

### "Constraint violation" Error
→ Ejecutar el script de nuevo (idempotente, seguro)

### Admin no existe
→ Verificar que el email en la BD sea `victoralfredo2498@gmail.com`

### Script muy lento
→ Puede tomar 1-2 minutos si hay muchos datos
→ No cerrar la ventana de SQL Editor

---

## 📝 Tabla de Contenidos del Script

1. **Sección 1**: Validar que el admin existe
2. **Sección 2**: Eliminar datos en orden (respetando Foreign Keys)
3. **Sección 3**: Mostrar resumen final

---

## 🎯 Resultado Final

```
✅ LIMPIEZA DE BASE DE DATOS COMPLETADA
   • Usuarios restantes: 1
   • Organización: [Nombre de la remisería]
   • Admin: victoralfredo2498@gmail.com
```

---

## 📅 Última actualización
**Abril 20, 2026** - Sistema listo para desarrollo limpio
