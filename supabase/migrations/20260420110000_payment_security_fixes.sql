-- ============================================================
-- PAYMENT SECURITY AUDIT FIXES
-- ============================================================
-- Date: 2025-04-20
-- Purpose: Add payment fraud prevention and audit tables

-- 1. Table for tracking processed Mercado Pago payments (idempotency)
-- Prevents double-crediting if webhook is retried
CREATE TABLE IF NOT EXISTS public.payments_processed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mp_payment_id TEXT NOT NULL UNIQUE,  -- Mercado Pago payment ID
    external_reference TEXT NOT NULL,     -- VIAJE_ or CHOFER_ reference
    user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL,        -- Amount in cents to avoid float issues
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mp_status TEXT,  -- 'approved', 'rejected', etc
    webhook_received_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payments_processed_mp_id ON public.payments_processed(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_processed_ext_ref ON public.payments_processed(external_reference);
CREATE INDEX IF NOT EXISTS idx_payments_processed_user ON public.payments_processed(user_id);

-- 2. Table for storing Mercado Pago preferences (for idempotency on frontend side)
-- Allows checking if a preference was already created for a trip
CREATE TABLE IF NOT EXISTS public.mercadopago_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viaje_id UUID UNIQUE REFERENCES public.viajes(id) ON DELETE CASCADE,
    chofer_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,  -- For chofer payments
    mp_preference_id TEXT NOT NULL UNIQUE,
    init_point TEXT,  -- Mercado Pago checkout URL
    estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'approved', 'rejected', 'cancelled')),
    amount_cents INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_mp_prefs_viaje_id ON public.mercadopago_preferences(viaje_id);
CREATE INDEX IF NOT EXISTS idx_mp_prefs_chofer_id ON public.mercadopago_preferences(chofer_id);
CREATE INDEX IF NOT EXISTS idx_mp_prefs_status ON public.mercadopago_preferences(estado);

-- 3. Audit log for payment transactions (compliance)
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment_created', 'payment_approved', 'payment_failed', 'refund', 'chargeback')),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    viaje_id UUID REFERENCES public.viajes(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'ARS',
    payment_method TEXT,  -- 'mercadopago', 'cash', 'wallet', etc
    external_payment_id TEXT,  -- MP payment_id, etc
    status TEXT,  -- Transaction result
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_audit_isolation" ON public.payment_audit_log
    FOR ALL
    USING (
        organizacion_id = public.get_current_organizacion_id() AND
        (public.get_auth_rol() IN ('admin', 'superadmin') OR user_id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_payment_audit_org ON public.payment_audit_log(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_user ON public.payment_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_viaje ON public.payment_audit_log(viaje_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_date ON public.payment_audit_log(created_at DESC);

-- 4. Alter viajes table to track payment status better
ALTER TABLE public.viajes 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS mp_payment_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP WITH TIME ZONE;

-- COMMENTS
COMMENT ON TABLE public.payments_processed IS 'Tracks all Mercado Pago payments to prevent duplicate crediting on webhook retry';
COMMENT ON TABLE public.mercadopago_preferences IS 'Stores MP preference info for idempotency on frontend (prevent double-checkout)';
COMMENT ON TABLE public.payment_audit_log IS 'Audit trail of all payment transactions for compliance and chargebacks';
COMMENT ON COLUMN public.viajes.payment_status IS 'Current payment status of the trip (for invoicing/reconciliation)';
COMMENT ON COLUMN public.viajes.mp_payment_id IS 'Mercado Pago payment ID if trip was paid via MP';
