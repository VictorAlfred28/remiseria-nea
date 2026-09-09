-- Migración V3: Origen del viaje y metadata de sesiones
-- Permite identificar de dónde proviene un viaje y quién lo creó, y darle memoria asíncrona al bot.

ALTER TABLE public.viajes 
ADD COLUMN IF NOT EXISTS canal_solicitud TEXT DEFAULT 'APP' CHECK (canal_solicitud IN ('APP', 'WHATSAPP', 'TELEFONO', 'ADMIN_PANEL', 'API')),
ADD COLUMN IF NOT EXISTS creado_por_rol TEXT DEFAULT 'PASAJERO' CHECK (creado_por_rol IN ('PASAJERO', 'BOT', 'OPERADOR', 'ADMIN'));

ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
