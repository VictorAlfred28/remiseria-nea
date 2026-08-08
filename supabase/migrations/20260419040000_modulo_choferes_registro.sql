-- Añadir campos de estado a usuarios 
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS estado text DEFAULT 'aprobado' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
ADD COLUMN IF NOT EXISTS direccion text;

-- Añadir campos de licencia, documentación y vehículo a choferes
ALTER TABLE public.choferes
ADD COLUMN IF NOT EXISTS estado_validacion text DEFAULT 'pendiente' CHECK (estado_validacion IN ('pendiente', 'aprobado', 'rechazado')),
ADD COLUMN IF NOT EXISTS licencia_numero text,
ADD COLUMN IF NOT EXISTS licencia_categoria text,
ADD COLUMN IF NOT EXISTS licencia_vencimiento text, -- o timestamp si se prefiere
ADD COLUMN IF NOT EXISTS documentos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tiene_vehiculo boolean DEFAULT true;

-- Asegurar que el bucket "documentos_choferes" existe en Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos_choferes', 'documentos_choferes', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para Storage (Permitir lectura y escritura pública para simplificar, o bien autenticado)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'documentos_choferes');
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documentos_choferes');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'documentos_choferes');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'documentos_choferes');
