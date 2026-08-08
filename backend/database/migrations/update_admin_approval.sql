-- 1. Añadir campos para auditoría de aprobación si no existen
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID;

-- 2. Normalizar valores legacy y nulos antes de aplicar un constraint
UPDATE public.usuarios 
SET estado = 'aprobado' 
WHERE estado IS NULL OR estado IN ('activo', 'disponible');

UPDATE public.usuarios 
SET estado = 'pendiente' 
WHERE estado NOT IN ('pendiente', 'aprobado', 'rechazado');

-- 3. Proteger al superadmin principal
UPDATE public.usuarios 
SET estado = 'aprobado', activo = true 
WHERE email = 'agentech.nea@gmail.com' OR rol = 'superadmin';

-- 4. Aplicar restricción CHECK para evitar estados inválidos (opcional pero recomendado)
-- ALTER TABLE public.usuarios ADD CONSTRAINT chk_usuarios_estado CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));

-- 5. Establecer el valor por defecto para 'estado' en la tabla de usuarios
ALTER TABLE public.usuarios 
ALTER COLUMN estado SET DEFAULT 'pendiente';

-- 6. Validar existencia del SuperAdmin principal
DO $$
DECLARE
    superadmin_count INT;
BEGIN
    SELECT COUNT(*) INTO superadmin_count FROM public.usuarios WHERE email = 'agentech.nea@gmail.com';
    IF superadmin_count = 0 THEN
        RAISE WARNING 'El usuario agentech.nea@gmail.com no existe en la base de datos. Asegúrate de crearlo para evitar pérdida de acceso administrativo.';
    ELSIF superadmin_count > 1 THEN
        RAISE WARNING 'Hay múltiples usuarios con el correo agentech.nea@gmail.com. Verifica para evitar conflictos de seguridad.';
    END IF;
END $$;
