-- ==============================================
-- TeleFlow: SETUP COMPLETO DO BANCO DE DADOS
-- Execute este script UMA VEZ no SQL Editor do Supabase
-- Ele cria todas as tabelas, indexes, RLS policies e storage
-- Ultima atualizacao: inclui Dragon Bio, Campaigns, Gateways
-- ==============================================

-- ============================================
-- PARTE 1: TABELA DE USUARIOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Allow anon read for admin" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.users;
DROP POLICY IF EXISTS "Allow anon update for admin" ON public.users;

CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow anon read for admin" ON public.users
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert for signup" ON public.users
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update for admin" ON public.users
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ============================================
-- PARTE 2: TABELA DE BOTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.bots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  group_name TEXT,
  group_id TEXT,
  group_link TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bots_user_id ON public.bots(user_id);

ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bots" ON public.bots;
DROP POLICY IF EXISTS "Users can create their own bots" ON public.bots;
DROP POLICY IF EXISTS "Users can update their own bots" ON public.bots;
DROP POLICY IF EXISTS "Users can delete their own bots" ON public.bots;
DROP POLICY IF EXISTS "Anon can read bots for webhook" ON public.bots;

CREATE POLICY "Users can view their own bots" ON public.bots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bots" ON public.bots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots" ON public.bots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots" ON public.bots
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anon can read bots for webhook" ON public.bots
  FOR SELECT TO anon USING (true);

-- ============================================
-- PARTE 3: TABELAS DE REFERRAL
-- ============================================

CREATE TABLE IF NOT EXISTS referral_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT coupon_code_lowercase CHECK (coupon_code = LOWER(coupon_code))
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_referred UNIQUE (referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_coupons_user_id ON referral_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_coupons_code ON referral_coupons(coupon_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);

ALTER TABLE referral_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all select on referral_coupons" ON referral_coupons;
DROP POLICY IF EXISTS "Allow all insert on referral_coupons" ON referral_coupons;
DROP POLICY IF EXISTS "Allow all update on referral_coupons" ON referral_coupons;
DROP POLICY IF EXISTS "Allow all delete on referral_coupons" ON referral_coupons;
DROP POLICY IF EXISTS "Allow all select on referrals" ON referrals;
DROP POLICY IF EXISTS "Allow all insert on referrals" ON referrals;
DROP POLICY IF EXISTS "Allow all update on referrals" ON referrals;
DROP POLICY IF EXISTS "Allow all delete on referrals" ON referrals;

CREATE POLICY "Allow all select on referral_coupons" ON referral_coupons
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow all insert on referral_coupons" ON referral_coupons
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow all update on referral_coupons" ON referral_coupons
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all delete on referral_coupons" ON referral_coupons
  FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Allow all select on referrals" ON referrals
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow all insert on referrals" ON referrals
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow all update on referrals" ON referrals
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all delete on referrals" ON referrals
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================
-- PARTE 4: TABELAS DE FLOWS E FLOW NODES
-- ============================================

CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Novo Fluxo',
  category TEXT DEFAULT 'personalizado',
  is_primary BOOLEAN DEFAULT false,
  flow_type TEXT NOT NULL DEFAULT 'complete' CHECK (flow_type IN ('basic', 'complete')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('trigger', 'message', 'delay', 'condition', 'payment', 'action', 'redirect')),
  label TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  message_text TEXT,
  flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'processed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flows_bot_id ON flows(bot_id);
CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id);
CREATE INDEX IF NOT EXISTS idx_flows_flow_type ON flows(flow_type);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow_id ON flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_position ON flow_nodes(flow_id, position);
CREATE INDEX IF NOT EXISTS idx_webhook_log_bot_id ON webhook_log(bot_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_chat_id ON webhook_log(chat_id);

ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own flows" ON flows;
DROP POLICY IF EXISTS "Users can insert own flows" ON flows;
DROP POLICY IF EXISTS "Users can update own flows" ON flows;
DROP POLICY IF EXISTS "Users can delete own flows" ON flows;
DROP POLICY IF EXISTS "Anon can read flows by bot_id" ON flows;

CREATE POLICY "Users can view own flows" ON flows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flows" ON flows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flows" ON flows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own flows" ON flows FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anon can read flows by bot_id" ON flows FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Users can view own flow nodes" ON flow_nodes;
DROP POLICY IF EXISTS "Users can insert own flow nodes" ON flow_nodes;
DROP POLICY IF EXISTS "Users can update own flow nodes" ON flow_nodes;
DROP POLICY IF EXISTS "Users can delete own flow nodes" ON flow_nodes;
DROP POLICY IF EXISTS "Anon can read flow nodes" ON flow_nodes;

CREATE POLICY "Users can view own flow nodes" ON flow_nodes FOR SELECT USING (EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_nodes.flow_id AND flows.user_id = auth.uid()));
CREATE POLICY "Users can insert own flow nodes" ON flow_nodes FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_nodes.flow_id AND flows.user_id = auth.uid()));
CREATE POLICY "Users can update own flow nodes" ON flow_nodes FOR UPDATE USING (EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_nodes.flow_id AND flows.user_id = auth.uid()));
CREATE POLICY "Users can delete own flow nodes" ON flow_nodes FOR DELETE USING (EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_nodes.flow_id AND flows.user_id = auth.uid()));
CREATE POLICY "Anon can read flow nodes" ON flow_nodes FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Users can view own webhook logs" ON webhook_log;
DROP POLICY IF EXISTS "Anon can insert webhook logs" ON webhook_log;
DROP POLICY IF EXISTS "Anon can read webhook logs" ON webhook_log;

CREATE POLICY "Users can view own webhook logs" ON webhook_log FOR SELECT USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = webhook_log.bot_id AND bots.user_id = auth.uid()));
CREATE POLICY "Anon can insert webhook logs" ON webhook_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can read webhook logs" ON webhook_log FOR SELECT TO anon USING (true);

-- ============================================
-- PARTE 5: USER FLOW STATE
-- ============================================

CREATE TABLE IF NOT EXISTS user_flow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  current_node_position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'waiting_response')),
  restart_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_id, flow_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_flow_state_lookup ON user_flow_state(bot_id, telegram_user_id);

ALTER TABLE user_flow_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can read user flow state" ON user_flow_state;
DROP POLICY IF EXISTS "Anon can insert user flow state" ON user_flow_state;
DROP POLICY IF EXISTS "Anon can update user flow state" ON user_flow_state;
DROP POLICY IF EXISTS "Users can view user flow state" ON user_flow_state;

CREATE POLICY "Anon can read user flow state" ON user_flow_state FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert user flow state" ON user_flow_state FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update user flow state" ON user_flow_state FOR UPDATE TO anon USING (true);
CREATE POLICY "Users can view user flow state" ON user_flow_state FOR SELECT USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = user_flow_state.bot_id AND bots.user_id = auth.uid()));

-- ============================================
-- PARTE 6: BOT USERS
-- ============================================

CREATE TABLE IF NOT EXISTS bot_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  funnel_step INTEGER NOT NULL DEFAULT 1,
  is_subscriber BOOLEAN NOT NULL DEFAULT false,
  subscription_plan TEXT,
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_users_bot_id ON bot_users(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram ON bot_users(bot_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_funnel ON bot_users(bot_id, funnel_step);
CREATE INDEX IF NOT EXISTS idx_bot_users_subscriber ON bot_users(bot_id, is_subscriber);

ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bot users" ON bot_users;
DROP POLICY IF EXISTS "Anon can read bot users" ON bot_users;
DROP POLICY IF EXISTS "Anon can insert bot users" ON bot_users;
DROP POLICY IF EXISTS "Anon can update bot users" ON bot_users;

CREATE POLICY "Users can view own bot users" ON bot_users FOR SELECT USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_users.bot_id AND bots.user_id = auth.uid()));
CREATE POLICY "Anon can read bot users" ON bot_users FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert bot users" ON bot_users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update bot users" ON bot_users FOR UPDATE TO anon USING (true);

-- ============================================
-- PARTE 7: BOT PLANS
-- ============================================

CREATE TABLE IF NOT EXISTS bot_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_plans_bot_id ON bot_plans(bot_id);

ALTER TABLE bot_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bot plans" ON bot_plans;
DROP POLICY IF EXISTS "Users can insert own bot plans" ON bot_plans;
DROP POLICY IF EXISTS "Users can update own bot plans" ON bot_plans;
DROP POLICY IF EXISTS "Users can delete own bot plans" ON bot_plans;
DROP POLICY IF EXISTS "Anon can read bot plans" ON bot_plans;

CREATE POLICY "Users can view own bot plans" ON bot_plans FOR SELECT USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_plans.bot_id AND bots.user_id = auth.uid()));
CREATE POLICY "Users can insert own bot plans" ON bot_plans FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_plans.bot_id AND bots.user_id = auth.uid()));
CREATE POLICY "Users can update own bot plans" ON bot_plans FOR UPDATE USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_plans.bot_id AND bots.user_id = auth.uid()));
CREATE POLICY "Users can delete own bot plans" ON bot_plans FOR DELETE USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_plans.bot_id AND bots.user_id = auth.uid()));
CREATE POLICY "Anon can read bot plans" ON bot_plans FOR SELECT TO anon USING (true);

-- ============================================
-- PARTE 8: GATEWAYS E PAGAMENTOS
-- ============================================

CREATE TABLE IF NOT EXISTS user_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  gateway_name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bot_id, gateway_name)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  telegram_user_id TEXT,
  gateway TEXT NOT NULL,
  external_payment_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  qr_code TEXT,
  qr_code_url TEXT,
  copy_paste TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  button_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  gateway TEXT DEFAULT 'mercadopago',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_gateways_user_id ON user_gateways(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gateways_bot_id ON user_gateways(bot_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_bot_id ON payments(bot_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_user_id ON payment_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_bot_id ON payment_plans(bot_id);

ALTER TABLE user_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gateways" ON user_gateways;
DROP POLICY IF EXISTS "Users can insert own gateways" ON user_gateways;
DROP POLICY IF EXISTS "Users can update own gateways" ON user_gateways;
DROP POLICY IF EXISTS "Users can delete own gateways" ON user_gateways;
DROP POLICY IF EXISTS "Anon can read gateways" ON user_gateways;

CREATE POLICY "Users can view own gateways" ON user_gateways FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gateways" ON user_gateways FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gateways" ON user_gateways FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gateways" ON user_gateways FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anon can read gateways" ON user_gateways FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;
DROP POLICY IF EXISTS "Anon can read payments" ON payments;
DROP POLICY IF EXISTS "Anon can insert payments" ON payments;
DROP POLICY IF EXISTS "Anon can update payments" ON payments;

CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payments" ON payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anon can read payments" ON payments FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert payments" ON payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update payments" ON payments FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "payment_plans_all" ON payment_plans;
CREATE POLICY "payment_plans_all" ON payment_plans FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PARTE 9: CAMPANHAS DE REMARKETING
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'concluida')),
  campaign_type TEXT NOT NULL DEFAULT 'basic' CHECK (campaign_type IN ('basic', 'complete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'delay')),
  label TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_node_id UUID NOT NULL REFERENCES campaign_nodes(id) ON DELETE CASCADE,
  bot_user_id UUID NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  bot_user_id UUID NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  current_node_position INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, bot_user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_bot_id ON campaigns(bot_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_nodes_campaign_id ON campaign_nodes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_nodes_position ON campaign_nodes(campaign_id, position);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_user ON campaign_sends(bot_user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_node ON campaign_sends(campaign_node_id);
CREATE INDEX IF NOT EXISTS idx_campaign_user_state_campaign ON campaign_user_state(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_user_state_next ON campaign_user_state(next_send_at) WHERE status = 'active';

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_user_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_all" ON campaigns;
DROP POLICY IF EXISTS "campaign_nodes_all" ON campaign_nodes;
DROP POLICY IF EXISTS "campaign_sends_all" ON campaign_sends;
DROP POLICY IF EXISTS "campaign_user_state_all" ON campaign_user_state;

CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_nodes_all" ON campaign_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_sends_all" ON campaign_sends FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_user_state_all" ON campaign_user_state FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PARTE 10: DRAGON BIO (Sites)
-- ============================================

CREATE TABLE IF NOT EXISTS dragon_bio_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  template VARCHAR(50) DEFAULT 'minimal',
  
  -- Profile data
  profile_name VARCHAR(255),
  profile_bio TEXT,
  profile_image TEXT,
  
  -- Theme/colors
  primary_color VARCHAR(20) DEFAULT '#8b5cf6',
  secondary_color VARCHAR(20) DEFAULT '#0f172a',
  text_color VARCHAR(20) DEFAULT '#ffffff',
  
  -- Stats
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dragon_bio_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES dragon_bio_sites(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  icon VARCHAR(50),
  position INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dragon_bio_sites_user_id ON dragon_bio_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_dragon_bio_sites_slug ON dragon_bio_sites(slug);
CREATE INDEX IF NOT EXISTS idx_dragon_bio_links_site_id ON dragon_bio_links(site_id);

ALTER TABLE dragon_bio_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE dragon_bio_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dragon_bio_sites_all" ON dragon_bio_sites;
DROP POLICY IF EXISTS "dragon_bio_links_all" ON dragon_bio_links;

CREATE POLICY "dragon_bio_sites_all" ON dragon_bio_sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dragon_bio_links_all" ON dragon_bio_links FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dragon_bio_sites_updated_at ON dragon_bio_sites;
CREATE TRIGGER dragon_bio_sites_updated_at
  BEFORE UPDATE ON dragon_bio_sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS dragon_bio_links_updated_at ON dragon_bio_links;
CREATE TRIGGER dragon_bio_links_updated_at
  BEFORE UPDATE ON dragon_bio_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PARTE 11: STORAGE BUCKET (flow-media)
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('flow-media', 'flow-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies for flow-media
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND (policyname LIKE '%flow-media%' OR policyname LIKE '%flow_media%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END$$;

CREATE POLICY "Allow public read flow-media" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'flow-media');

CREATE POLICY "Allow public upload flow-media" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'flow-media');

CREATE POLICY "Allow public update flow-media" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'flow-media')
  WITH CHECK (bucket_id = 'flow-media');

CREATE POLICY "Allow public delete flow-media" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'flow-media');

-- Policies para bucket media
CREATE POLICY "Allow public read media" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'media');

CREATE POLICY "Allow public upload media" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow public update media" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow public delete media" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'media');

-- ============================================
-- FIM DO SETUP COMPLETO
-- ============================================
