-- Adicionar campos para ajuste manual de saldo de afiliado
-- Este campo permite que admins ajustem o saldo sem precisar de tabela separada

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS affiliate_balance_adjustment DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS affiliate_balance_reason TEXT;

-- Comentarios para documentacao
COMMENT ON COLUMN users.affiliate_balance_adjustment IS 'Ajuste manual do saldo de afiliado feito por admin';
COMMENT ON COLUMN users.affiliate_balance_reason IS 'Motivo do ultimo ajuste de saldo';
