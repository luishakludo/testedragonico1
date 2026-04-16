-- Tabela para armazenar historico de mensagens do bot
CREATE TABLE IF NOT EXISTS bot_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  user_first_name TEXT,
  user_last_name TEXT,
  user_username TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'photo', 'video', 'document', 'audio', 'voice', 'sticker', 'callback')),
  content TEXT,
  media_url TEXT,
  telegram_message_id INTEGER,
  reply_to_message_id INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_bot_messages_bot_id ON bot_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_telegram_user_id ON bot_messages(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created_at ON bot_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_messages_bot_user ON bot_messages(bot_id, telegram_user_id);

-- RLS
ALTER TABLE bot_messages ENABLE ROW LEVEL SECURITY;

-- Politica para usuarios verem apenas mensagens dos seus bots
CREATE POLICY "Users can view messages from their bots" ON bot_messages
  FOR SELECT
  USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- Politica para inserir mensagens (service role ou webhook)
CREATE POLICY "Service can insert messages" ON bot_messages
  FOR INSERT
  WITH CHECK (true);

-- Politica para atualizar mensagens
CREATE POLICY "Users can update messages from their bots" ON bot_messages
  FOR UPDATE
  USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );
