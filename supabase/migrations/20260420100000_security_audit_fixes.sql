-- ============================================================
-- SECURITY AUDIT FIXES - Phase 1
-- ============================================================
-- Date: 2025-04-20
-- Purpose: Fix critical security issues found during production audit
--
-- Issues Fixed:
-- 1. ADD organizacion_id validation for public registration endpoints
-- 2. ADD token revocation mechanism (placeholder for Redis-based invalidation)
--

-- 1. Add acepta_registros_publicos control to organizaciones table
-- This allows orgs to disable public registration (client/driver signup)
ALTER TABLE public.organizaciones 
ADD COLUMN IF NOT EXISTS acepta_registros_publicos BOOLEAN DEFAULT true;

-- 2. Create TABLE for token revocation blacklist
-- This will store invalidated tokens (from logout events) with expiration
CREATE TABLE IF NOT EXISTS public.token_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,  -- Hash of JWT token (for security - don't store raw), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- When token naturally expires
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- When it was manually revoked (logout)
);

-- Enable RLS on token_blacklist
ALTER TABLE public.token_blacklist ENABLE ROW LEVEL SECURITY;

-- Basic policy: users can only see their own token revocations (admin can see all)
CREATE POLICY "token_blacklist_isolation" ON public.token_blacklist
    FOR ALL
    USING (
        user_id = auth.uid() OR 
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON public.token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON public.token_blacklist(user_id);

-- 3. Create audit log table for tracking important security events
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'TOKEN_REVOKE',
        'PASSWORD_CHANGE',
        'ROLE_CHANGE',
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'REGISTRATION_ATTEMPT',
        'ORG_CHANGE'
    )),
    ip_address TEXT,
    user_agent TEXT,
    resource_accessed TEXT,  -- What endpoint/resource was attempted
    details JSONB,            -- Additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit logs visible only to admins and superadmins
CREATE POLICY "audit_log_isolation" ON public.security_audit_log
    FOR ALL
    USING (
        organizacion_id = public.get_current_organizacion_id() AND 
        public.get_auth_rol() IN ('admin', 'superadmin')
    );

-- 4. Create index on security_audit_log for fast queries
CREATE INDEX IF NOT EXISTS idx_security_audit_org_id ON public.security_audit_log(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON public.security_audit_log(created_at DESC);

-- 5. Add rate limiting state table (for distributed rate limiting)
-- This tracks registration attempts and other rate-limited actions
CREATE TABLE IF NOT EXISTS public.rate_limit_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_key TEXT NOT NULL UNIQUE,  -- e.g., "register:email@example.com", "register:192.168.1.1"
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_blocked BOOLEAN DEFAULT false,
    blocked_until TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_action_key ON public.rate_limit_state(action_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked_until ON public.rate_limit_state(blocked_until);

-- COMMENTS for documentation
COMMENT ON TABLE public.token_blacklist IS 'Stores invalidated JWT tokens (logged out or revoked) for verification';
COMMENT ON TABLE public.security_audit_log IS 'Audit trail of security-relevant events for compliance and debugging';
COMMENT ON TABLE public.rate_limit_state IS 'Distributed rate limiting state for registration and other actions';
COMMENT ON COLUMN public.organizaciones.acepta_registros_publicos IS 'Controls whether public clients/drivers can register in this organization';
