-- Adicionar campo affiliate_balance na tabela users (se não existir)
ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_balance DECIMAL(10,2) DEFAULT 0;
