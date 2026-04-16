-- Adiciona coluna avatar_url na tabela bots
-- Para salvar a foto do bot no Supabase Storage (já que o Telegram não aceita upload de foto via API)

ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
