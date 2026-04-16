-- Adiciona coluna page_type para identificar o tipo de cada pagina
ALTER TABLE dragon_bio_sites 
ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'dragonbio';

-- Atualizar paginas existentes baseado no slug (se possivel identificar)
UPDATE dragon_bio_sites SET page_type = 'presell' WHERE slug LIKE 'presell-%' AND page_type IS NULL;
UPDATE dragon_bio_sites SET page_type = 'conversion' WHERE slug LIKE 'conversion-%' AND page_type IS NULL;
UPDATE dragon_bio_sites SET page_type = 'checkout' WHERE slug LIKE 'checkout-%' AND page_type IS NULL;
UPDATE dragon_bio_sites SET page_type = 'dragonbio' WHERE page_type IS NULL;
