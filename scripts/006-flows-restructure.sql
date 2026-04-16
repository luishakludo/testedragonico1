-- ============================================
-- MIGRATION: Reestruturar Sistema de Fluxos
-- Fluxos vinculados ao usuario (max 50)
-- Cada fluxo pode ter ate 5 bots
-- ============================================

-- 1. Adicionar novas colunas na tabela flows
ALTER TABLE flows ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE flows ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE flows ADD COLUMN IF NOT EXISTS media_cache_chat_id BIGINT;
ALTER TABLE flows ADD COLUMN IF NOT EXISTS support_username TEXT;
ALTER TABLE flows ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'BR';

-- 2. Atualizar flow_type para incluir 'n8n'
ALTER TABLE flows DROP CONSTRAINT IF EXISTS flows_flow_type_check;
ALTER TABLE flows ADD CONSTRAINT flows_flow_type_check CHECK (flow_type IN ('basic', 'complete', 'n8n'));

-- 3. Criar tabela flow_bots para vincular bots aos fluxos
CREATE TABLE IF NOT EXISTS flow_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_id, bot_id)
);

-- 4. Criar indice para performance
CREATE INDEX IF NOT EXISTS idx_flow_bots_flow_id ON flow_bots(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_bots_bot_id ON flow_bots(bot_id);

-- 5. Habilitar RLS
ALTER TABLE flow_bots ENABLE ROW LEVEL SECURITY;

-- 6. Politicas de seguranca para flow_bots
DROP POLICY IF EXISTS "Users can view own flow_bots" ON flow_bots;
DROP POLICY IF EXISTS "Users can insert own flow_bots" ON flow_bots;
DROP POLICY IF EXISTS "Users can delete own flow_bots" ON flow_bots;
DROP POLICY IF EXISTS "Anon can read flow_bots" ON flow_bots;

CREATE POLICY "Users can view own flow_bots" ON flow_bots 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_bots.flow_id AND flows.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own flow_bots" ON flow_bots 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_bots.flow_id AND flows.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM bots WHERE bots.id = flow_bots.bot_id AND bots.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own flow_bots" ON flow_bots 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_bots.flow_id AND flows.user_id = auth.uid())
  );

CREATE POLICY "Anon can read flow_bots" ON flow_bots 
  FOR SELECT TO anon USING (true);

-- 7. Funcao para contar bots por fluxo (max 5)
CREATE OR REPLACE FUNCTION check_flow_bot_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM flow_bots WHERE flow_id = NEW.flow_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 bots per flow allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger para limitar bots por fluxo
DROP TRIGGER IF EXISTS enforce_flow_bot_limit ON flow_bots;
CREATE TRIGGER enforce_flow_bot_limit
  BEFORE INSERT ON flow_bots
  FOR EACH ROW EXECUTE FUNCTION check_flow_bot_limit();

-- 9. Tornar bot_id opcional na tabela flows (agora usa flow_bots)
ALTER TABLE flows ALTER COLUMN bot_id DROP NOT NULL;
