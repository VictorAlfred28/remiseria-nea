-- Agregamos la columna a usuarios (clientes, comercios, etc.)
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

-- Nota: Para que el sistema de subida funcione, es FUNDAMENTAL
-- contar con un bucket de almacenamiento (Storage) llamado 'avatars' en Supabase.
-- Por seguridad, se recomienda que dicho bucket sea creado manualmente en el
-- Panel de Control de Supabase -> "Storage" -> "Create Bucket".
-- 
-- El nombre exacto debe ser: "avatars"
-- Marcar la casilla "Public bucket" al crearlo para que las fotografías 
-- puedan cargarse velozmente y cachearse por la CDN sin tokens de autenticación para su lectura.

-- Políticas sugeridas a establecer en su panel de Storage (Sección Polices)
-- 1. "SELECT": Public access a bucket_id = 'avatars'
-- 2. "INSERT/UPDATE/DELETE": Auth.role() = 'authenticated' AND (almacenar en su propia carpeta UUID)
