-- ==============================================
-- Adicionar coluna pixel_config na tabela dragon_bio_sites
-- Para armazenar configuracoes de pixel (Meta/Facebook ou UTMify)
-- ==============================================

-- Adicionar coluna pixel_config (JSONB para flexibilidade)
ALTER TABLE dragon_bio_sites 
ADD COLUMN IF NOT EXISTS pixel_config JSONB DEFAULT NULL;

-- Estrutura esperada do pixel_config:
-- {
--   "type": "meta" | "utmify" | null,
--   "meta_pixel_id": "3675047522752828",  -- se type = "meta"
--   "utmify_token": "6977e0a485f877673600790c"  -- se type = "utmify"
-- }

-- Criar indice para buscar sites com pixel configurado
CREATE INDEX IF NOT EXISTS idx_dragon_bio_sites_pixel ON dragon_bio_sites((pixel_config IS NOT NULL));

COMMENT ON COLUMN dragon_bio_sites.pixel_config IS 'Configuracao de pixel de rastreamento (Meta/Facebook ou UTMify)';
