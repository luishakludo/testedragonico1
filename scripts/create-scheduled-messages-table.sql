-- Tabela para agendar mensagens de upsell e downsell
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('upsell', 'downsell')),
  sequence_id TEXT NOT NULL, -- ID da sequencia (seq-xxx ou ds-seq-xxx)
  sequence_index INTEGER NOT NULL DEFAULT 0, -- Indice da sequencia
  scheduled_for TIMESTAMPTZ NOT NULL, -- Quando deve ser enviado
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}', -- Dados extras (preco, mensagem, midias, etc)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_bot_id ON scheduled_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user ON scheduled_messages(telegram_user_id, bot_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending ON scheduled_messages(status, scheduled_for) WHERE status = 'pending';

-- RLS Policies
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Policy para permitir que usuarios vejam apenas mensagens dos seus bots
CREATE POLICY "Users can view their scheduled messages" ON scheduled_messages
  FOR SELECT USING (
    bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Policy para permitir insercoes de mensagens dos seus bots
CREATE POLICY "Users can insert their scheduled messages" ON scheduled_messages
  FOR INSERT WITH CHECK (
    bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Policy para permitir atualizacoes de mensagens dos seus bots
CREATE POLICY "Users can update their scheduled messages" ON scheduled_messages
  FOR UPDATE USING (
    bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Policy para permitir que o service role faca tudo (para o webhook e cron)
CREATE POLICY "Service role can manage all scheduled messages" ON scheduled_messages
  FOR ALL USING (true) WITH CHECK (true);
-- Nota: O webhook usa supabase client normal, entao precisamos permitir todas operacoes

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_scheduled_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scheduled_messages_updated_at ON scheduled_messages;
CREATE TRIGGER trigger_scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_messages_updated_at();
