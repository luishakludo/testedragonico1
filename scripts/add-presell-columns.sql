-- Adicionar colunas para presell na tabela dragon_bio_sites
ALTER TABLE dragon_bio_sites 
ADD COLUMN IF NOT EXISTS page_data JSONB,
ADD COLUMN IF NOT EXISTS presell_type TEXT;

-- Comentarios para documentacao
COMMENT ON COLUMN dragon_bio_sites.page_data IS 'Dados de configuracao da pagina presell (ageData, thankYouData, redirectData)';
COMMENT ON COLUMN dragon_bio_sites.presell_type IS 'Tipo de presell: age-verification, thank-you, redirect';
