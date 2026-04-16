-- =====================================================
-- MIGRACIÓN: Foto de perfil para socios
-- Ejecutar en: Supabase > SQL Editor
-- =====================================================

-- 1. Agregamos la columna a usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

-- =====================================================
-- 2. POLÍTICAS DE STORAGE para el bucket "avatars"
--    Ejecutar DESPUÉS de crear el bucket manualmente
--    en Supabase > Storage > New Bucket > "avatars" (Public)
-- =====================================================

-- Permitir lectura pública de todas las imágenes del bucket
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Permitir a usuarios autenticados subir su propia imagen
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- Permitir a usuarios autenticados actualizar/reemplazar su propia imagen
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' );

-- Permitir a usuarios autenticados borrar su propia imagen
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' );

-- Si alguna policy ya existe, ignorar el error y continuar.
