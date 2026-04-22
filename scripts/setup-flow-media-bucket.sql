-- Script para criar o bucket flow-media no Supabase Storage
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Criar o bucket se nao existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flow-media',
  'flow-media',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'];

-- 2. Politica para permitir upload autenticado
CREATE POLICY "Usuarios autenticados podem fazer upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'flow-media');

-- 3. Politica para permitir leitura publica (necessario para Telegram acessar as midias)
CREATE POLICY "Acesso publico de leitura" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'flow-media');

-- 4. Politica para permitir que usuarios deletem seus proprios arquivos
CREATE POLICY "Usuarios podem deletar seus arquivos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'flow-media');

-- 5. Politica para permitir atualizacao
CREATE POLICY "Usuarios podem atualizar seus arquivos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'flow-media');
