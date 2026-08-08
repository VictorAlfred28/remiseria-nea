BEGIN;

-- 1. Secuencia para numero_socio
CREATE SEQUENCE IF NOT EXISTS usuarios_numero_socio_seq START 1;

-- 2. Agregar columna numero_socio a tabla usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS numero_socio BIGINT UNIQUE;

-- 3. Backfill para usuarios existentes
UPDATE public.usuarios 
SET numero_socio = nextval('usuarios_numero_socio_seq') 
WHERE numero_socio IS NULL;

-- 4. Setear constraints
ALTER TABLE public.usuarios ALTER COLUMN numero_socio SET NOT NULL;
ALTER TABLE public.usuarios ALTER COLUMN numero_socio SET DEFAULT nextval('usuarios_numero_socio_seq');

-- 5. Indice
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_numero_socio ON public.usuarios(numero_socio);

-- 6. Tabla Anti-Replay qr_nonces
CREATE TABLE IF NOT EXISTS public.qr_nonces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nonce UUID UNIQUE NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    usado_en TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_qr_nonces_nonce_usado ON public.qr_nonces(nonce, usado);

-- 7. Modificar tabla de auditoría
ALTER TABLE public.historial_escaneos_socios
ADD COLUMN IF NOT EXISTS numero_socio BIGINT,
ADD COLUMN IF NOT EXISTS nonce UUID,
ADD COLUMN IF NOT EXISTS beneficio TEXT,
ADD COLUMN IF NOT EXISTS descuento NUMERIC,
ADD COLUMN IF NOT EXISTS resultado TEXT;

COMMIT;
