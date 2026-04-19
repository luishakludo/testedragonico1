-- Adicionar coluna duration_days na tabela flow_plans
-- Esta coluna armazena a duracao do plano em dias para calcular expiracao

ALTER TABLE flow_plans ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT NULL;

-- Comentario explicativo
COMMENT ON COLUMN flow_plans.duration_days IS 'Duracao do plano em dias. NULL = vitalicio. Calculado baseado em duration_type ou valor customizado.';

-- Atualizar registros existentes baseado em duration_type do config
-- (Isso sera feito via aplicacao quando salvar o plano)

-- Criar indice para buscas por duracao
CREATE INDEX IF NOT EXISTS idx_flow_plans_duration ON flow_plans(duration_days);
