-- Criar bucket para midias dos fluxos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flow-medias',
  'flow-medias',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Politica para permitir upload autenticado
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'flow-medias');

-- Politica para permitir leitura publica
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'flow-medias');

-- Politica para permitir delete pelo dono
CREATE POLICY "Allow delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'flow-medias');
