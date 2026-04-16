-- ============================================
-- MIGRATION: Sistema de Grupo VIP
-- Tabelas para grupos VIP e convites
-- ============================================

-- 1. Tabela de grupos VIP (cada bot pode ter 1 grupo VIP)
CREATE TABLE IF NOT EXISTS vip_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'supergroup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_id)
);

CREATE INDEX IF NOT EXISTS idx_vip_groups_bot_id ON vip_groups(bot_id);

ALTER TABLE vip_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own vip_groups" ON vip_groups;
DROP POLICY IF EXISTS "Users can insert own vip_groups" ON vip_groups;
DROP POLICY IF EXISTS "Users can update own vip_groups" ON vip_groups;
DROP POLICY IF EXISTS "Users can delete own vip_groups" ON vip_groups;
DROP POLICY IF EXISTS "Anon can read vip_groups" ON vip_groups;

CREATE POLICY "Users can view own vip_groups" ON vip_groups 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_groups.bot_id AND bots.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own vip_groups" ON vip_groups 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_groups.bot_id AND bots.user_id = auth.uid())
  );

CREATE POLICY "Users can update own vip_groups" ON vip_groups 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_groups.bot_id AND bots.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own vip_groups" ON vip_groups 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_groups.bot_id AND bots.user_id = auth.uid())
  );

CREATE POLICY "Anon can read vip_groups" ON vip_groups 
  FOR SELECT TO anon USING (true);

-- 2. Tabela de convites VIP gerados
CREATE TABLE IF NOT EXISTS vip_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  vip_group_id UUID NOT NULL REFERENCES vip_groups(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  invite_link TEXT NOT NULL,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vip_invites_bot_id ON vip_invites(bot_id);
CREATE INDEX IF NOT EXISTS idx_vip_invites_telegram_user ON vip_invites(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_vip_invites_used ON vip_invites(used);

ALTER TABLE vip_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Users can insert own vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Users can update own vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Anon can read vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Anon can insert vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Anon can update vip_invites" ON vip_invites;

CREATE POLICY "Users can view own vip_invites" ON vip_invites 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_invites.bot_id AND bots.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own vip_invites" ON vip_invites 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_invites.bot_id AND bots.user_id = auth.uid())
  );

CREATE POLICY "Users can update own vip_invites" ON vip_invites 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_invites.bot_id AND bots.user_id = auth.uid())
  );

CREATE POLICY "Anon can read vip_invites" ON vip_invites 
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert vip_invites" ON vip_invites 
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update vip_invites" ON vip_invites 
  FOR UPDATE TO anon USING (true);
