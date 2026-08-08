-- =====================================================
-- MIGRACIÓN: Agregar campo 'recomendado' a calificaciones
-- Permite a pasajeros recomendar choferes tras un viaje
-- =====================================================

ALTER TABLE public.calificaciones 
ADD COLUMN IF NOT EXISTS recomendado BOOLEAN DEFAULT FALSE;
