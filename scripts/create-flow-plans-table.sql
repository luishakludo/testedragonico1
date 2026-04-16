-- Criar tabela de planos dos fluxos
CREATE TABLE IF NOT EXISTS flow_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  delivery_type VARCHAR(50) DEFAULT 'none',
  delivery_content TEXT,
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_flow_plans_flow_id ON flow_plans(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_plans_active ON flow_plans(flow_id, is_active);

-- RLS
ALTER TABLE flow_plans ENABLE ROW LEVEL SECURITY;

-- Politica para usuarios verem seus proprios planos (via flow)
CREATE POLICY "Users can view own flow plans"
ON flow_plans
FOR SELECT
USING (
  flow_id IN (
    SELECT id FROM flows WHERE user_id = auth.uid()
  )
);

-- Politica para usuarios inserirem planos nos seus fluxos
CREATE POLICY "Users can insert own flow plans"
ON flow_plans
FOR INSERT
WITH CHECK (
  flow_id IN (
    SELECT id FROM flows WHERE user_id = auth.uid()
  )
);

-- Politica para usuarios atualizarem seus planos
CREATE POLICY "Users can update own flow plans"
ON flow_plans
FOR UPDATE
USING (
  flow_id IN (
    SELECT id FROM flows WHERE user_id = auth.uid()
  )
);

-- Politica para usuarios deletarem seus planos
CREATE POLICY "Users can delete own flow plans"
ON flow_plans
FOR DELETE
USING (
  flow_id IN (
    SELECT id FROM flows WHERE user_id = auth.uid()
  )
);

-- Politica para service role (webhook)
CREATE POLICY "Service role full access to flow_plans"
ON flow_plans
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
