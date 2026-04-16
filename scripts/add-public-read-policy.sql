-- Permite leitura publica dos sites (para a pagina /s/[slug])
-- Isso e necessario porque a pagina publica nao requer autenticacao

-- Policy para SELECT publico na tabela dragon_bio_sites
CREATE POLICY IF NOT EXISTS "allow_public_read_sites" 
ON dragon_bio_sites 
FOR SELECT 
TO anon
USING (true);

-- Policy para SELECT publico na tabela dragon_bio_links
CREATE POLICY IF NOT EXISTS "allow_public_read_links" 
ON dragon_bio_links 
FOR SELECT 
TO anon
USING (true);
