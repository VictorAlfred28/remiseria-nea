-- Migration para FASE 2: Bandera de operador humano
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS operador_humano BOOLEAN DEFAULT FALSE;
