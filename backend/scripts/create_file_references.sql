-- Migration: Create file_references table for upload cleanup and tracking
-- Timestamp: 2026-05-28

CREATE TABLE IF NOT EXISTS public.file_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    bucket_name TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    referenced_by TEXT, -- Puede ser el nombre de la tabla (ej. 'usuarios', 'choferes')
    deleted_at TIMESTAMP WITH TIME ZONE,
    grace_until TIMESTAMP WITH TIME ZONE,
    checksum TEXT -- SHA256 opcional para prevenir duplicados
);

CREATE INDEX IF NOT EXISTS idx_file_references_owner ON public.file_references(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_references_path ON public.file_references(path);
CREATE INDEX IF NOT EXISTS idx_file_references_active ON public.file_references(is_active);
CREATE INDEX IF NOT EXISTS idx_file_references_grace ON public.file_references(grace_until);
CREATE INDEX IF NOT EXISTS idx_file_references_last_used ON public.file_references(last_used_at);

-- Tabla de auditoría para la limpieza del cron
CREATE TABLE IF NOT EXISTS public.storage_cleanup_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path TEXT NOT NULL,
    bucket_name TEXT NOT NULL,
    motivo TEXT,
    tamano_liberado BIGINT,
    estado TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.file_references ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "files_select" ON public.file_references
    FOR SELECT USING (auth.uid() = owner_id OR (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin');

CREATE POLICY "files_insert" ON public.file_references
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "files_update" ON public.file_references
    FOR UPDATE USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Para permitir a Supabase admin/Cron hacer mantenimiento bypass RLS se usa la key de service_role.
