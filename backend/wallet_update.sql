-- backend/wallet_update.sql

-- 1. Añadimos campo de saldo a choferes si no existe
ALTER TABLE public.choferes ADD COLUMN IF NOT EXISTS saldo NUMERIC(10,2) DEFAULT 0;

-- 2. Tabla para registrar los movimientos de saldo de la Billetera
CREATE TABLE IF NOT EXISTS public.movimientos_saldo (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    chofer_id UUID REFERENCES public.choferes(id) ON DELETE CASCADE,
    monto NUMERIC(10,2) NOT NULL, 
    -- Si es cargo a la base: monto negativo (ej. -3000 por diaria)
    -- Si es pago (Vía MP o Efectivo en base): monto positivo (ej. +3000)
    tipo VARCHAR(50) NOT NULL, -- ej. 'cargo_diario', 'cargo_viaje', 'pago_mp', 'pago_efectivo'
    descripcion TEXT,
    mp_payment_id VARCHAR(255), -- ID de Mercado Pago si aplica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.movimientos_saldo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Movimientos visibles para el chofer correspondiente"
    ON public.movimientos_saldo FOR SELECT
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- Admins pueden insertar movimientos (ej. cobrar diaria)
CREATE POLICY "Admins pueden registrar cargos o pagos manuales"
    ON public.movimientos_saldo FOR INSERT
    WITH CHECK (organizacion_id = public.get_auth_orga_id());

-- El backend mediante Service Key ignorará RLS para reportar pagos de MercadoPago automáticos.
