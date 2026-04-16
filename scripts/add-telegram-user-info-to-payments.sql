-- Adicionar colunas para dados do usuario do Telegram na tabela payments
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_first_name TEXT,
ADD COLUMN IF NOT EXISTS telegram_last_name TEXT,
ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT;
