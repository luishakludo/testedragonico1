-- Adicionar coluna flow_id na tabela payments para rastrear de qual fluxo veio a venda
-- Executar este script no Supabase SQL Editor

-- Adicionar coluna flow_id
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS flow_id UUID REFERENCES flows(id) ON DELETE SET NULL;

-- Criar indice para busca por flow_id
CREATE INDEX IF NOT EXISTS idx_payments_flow_id ON payments(flow_id);

-- Comentario
COMMENT ON COLUMN payments.flow_id IS 'ID do fluxo onde a venda foi gerada';
