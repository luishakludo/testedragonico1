-- Adicionar colunas type e image na tabela dragon_bio_links
-- type: 'button' (padrao) ou 'card' (card com imagem)
-- image: URL da imagem para cards

ALTER TABLE dragon_bio_links 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'button';

ALTER TABLE dragon_bio_links 
ADD COLUMN IF NOT EXISTS image TEXT;
