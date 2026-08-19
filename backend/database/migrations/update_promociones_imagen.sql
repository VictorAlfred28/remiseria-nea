-- MIGRACIÓN: AGREGAR IMAGEN A PROMOCIONES
-- Añadir soporte para subir imágenes de portadas en las ofertas de los comercios

ALTER TABLE public.promociones 
ADD COLUMN IF NOT EXISTS imagen_url TEXT;
