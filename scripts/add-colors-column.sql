-- Adicionar coluna colors à tabela dragon_bio_sites
-- Execute este script no Supabase SQL Editor

ALTER TABLE dragon_bio_sites 
ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '{
  "primary": "#000000",
  "secondary": "#ffffff",
  "accent": "#3b82f6",
  "background": "#0f172a",
  "text": "#ffffff"
}'::jsonb;
