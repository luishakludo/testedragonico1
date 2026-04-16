-- =============================================
-- BOT GROUPS - Grupos onde o bot é admin
-- =============================================
-- Capturados via webhook my_chat_member

-- Drop if exists
DROP TABLE IF EXISTS bot_groups CASCADE;

-- Create bot_groups table
CREATE TABLE bot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  chat_type TEXT NOT NULL DEFAULT 'group', -- group, supergroup, channel
  is_admin BOOLEAN DEFAULT false,
  can_invite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each bot can only have one entry per chat
  UNIQUE(bot_id, chat_id)
);

-- Index for fast lookups
CREATE INDEX idx_bot_groups_bot_id ON bot_groups(bot_id);
CREATE INDEX idx_bot_groups_chat_id ON bot_groups(chat_id);

-- RLS
ALTER TABLE bot_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see groups of their own bots
CREATE POLICY "Users can view their bot groups"
  ON bot_groups FOR SELECT
  USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert/update (via service role from webhook)
CREATE POLICY "Service can manage bot groups"
  ON bot_groups FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON bot_groups TO authenticated;
GRANT ALL ON bot_groups TO service_role;
