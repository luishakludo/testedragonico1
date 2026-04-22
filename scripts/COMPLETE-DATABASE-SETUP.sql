-- ==============================================
-- DRAGON/TELEFLOW: SCRIPT COMPLETO E CONSOLIDADO DO BANCO DE DADOS
-- ==============================================
-- Este e o UNICO arquivo SQL necessario para configurar todo o banco de dados.
-- Execute este script UMA VEZ no SQL Editor do Supabase.
-- Ele cria todas as tabelas, indexes, RLS policies, triggers, funcoes e storage buckets.
--
-- Ultima atualizacao: Consolidacao de todos os 35 scripts em um unico arquivo
-- ==============================================

-- ============================================
-- PARTE 1: FUNCOES AUXILIARES
-- ============================================

-- Funcao para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PARTE 2: TABELA DE USUARIOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  banned BOOLEAN NOT NULL DEFAULT false,
  -- Campos de afiliado
  affiliate_balance DECIMAL(10, 2) DEFAULT 0,
  affiliate_balance_adjustment DECIMAL(10, 2) DEFAULT 0,
  affiliate_balance_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

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

-- Comentarios
COMMENT ON COLUMN users.affiliate_balance IS 'Saldo atual de afiliado (cache)';
COMMENT ON COLUMN users.affiliate_balance_adjustment IS 'Ajuste manual do saldo feito por admin';
COMMENT ON COLUMN users.affiliate_balance_reason IS 'Motivo do ultimo ajuste';

-- ============================================
-- PARTE 3: TABELA DE BOTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.bots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  group_name TEXT,
  group_id TEXT,
  group_link TEXT,
  avatar_url TEXT DEFAULT '',
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
-- PARTE 4: TABELAS DE REFERRAL (Sistema de Afiliados)
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
  commission_amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_referred UNIQUE (referred_id)
);

CREATE TABLE IF NOT EXISTS referral_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'sale',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_withdraws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  pix_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_coupons_user_id ON referral_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_coupons_code ON referral_coupons(coupon_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_sales_referrer ON referral_sales(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_sales_created ON referral_sales(created_at);
CREATE INDEX IF NOT EXISTS idx_referral_withdraws_user_id ON referral_withdraws(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_withdraws_status ON referral_withdraws(status);

ALTER TABLE referral_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_withdraws ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can read own referral sales" ON referral_sales
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Service role can insert referral sales" ON referral_sales
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can manage all referral sales" ON referral_sales
  FOR ALL USING (true) WITH CHECK (true);

-- Comentarios
COMMENT ON COLUMN referrals.commission_amount IS 'Valor da comissao do afiliado por esta indicacao';
COMMENT ON COLUMN referrals.status IS 'Status da indicacao: active, admin_adjustment, etc';

-- ============================================
-- PARTE 5: TABELAS DE FLOWS E FLOW NODES
-- ============================================

CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Novo Fluxo',
  category TEXT DEFAULT 'personalizado',
  is_primary BOOLEAN DEFAULT false,
  flow_type TEXT NOT NULL DEFAULT 'complete' CHECK (flow_type IN ('basic', 'complete', 'n8n')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado')),
  -- Campos adicionais da reestruturacao
  welcome_message TEXT,
  config JSONB DEFAULT '{}',
  media_cache_chat_id BIGINT,
  support_username TEXT,
  country TEXT DEFAULT 'BR',
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

CREATE TABLE IF NOT EXISTS flow_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_id, bot_id)
);

CREATE TABLE IF NOT EXISTS flow_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  delivery_type VARCHAR(50) DEFAULT 'none',
  delivery_content TEXT,
  duration_days INTEGER DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_flow_bots_flow_id ON flow_bots(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_bots_bot_id ON flow_bots(bot_id);
CREATE INDEX IF NOT EXISTS idx_flow_plans_flow_id ON flow_plans(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_plans_active ON flow_plans(flow_id, is_active);
CREATE INDEX IF NOT EXISTS idx_flow_plans_duration ON flow_plans(duration_days);
CREATE INDEX IF NOT EXISTS idx_webhook_log_bot_id ON webhook_log(bot_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_chat_id ON webhook_log(chat_id);

ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_plans ENABLE ROW LEVEL SECURITY;
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

-- Flow Plans Policies
CREATE POLICY "Users can view own flow plans" ON flow_plans
  FOR SELECT USING (flow_id IN (SELECT id FROM flows WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own flow plans" ON flow_plans
  FOR INSERT WITH CHECK (flow_id IN (SELECT id FROM flows WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own flow plans" ON flow_plans
  FOR UPDATE USING (flow_id IN (SELECT id FROM flows WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own flow plans" ON flow_plans
  FOR DELETE USING (flow_id IN (SELECT id FROM flows WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to flow_plans" ON flow_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own webhook logs" ON webhook_log;
DROP POLICY IF EXISTS "Anon can insert webhook logs" ON webhook_log;
DROP POLICY IF EXISTS "Anon can read webhook logs" ON webhook_log;

CREATE POLICY "Users can view own webhook logs" ON webhook_log FOR SELECT USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = webhook_log.bot_id AND bots.user_id = auth.uid()));
CREATE POLICY "Anon can insert webhook logs" ON webhook_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can read webhook logs" ON webhook_log FOR SELECT TO anon USING (true);

-- Funcao para limitar bots por fluxo (max 5)
CREATE OR REPLACE FUNCTION check_flow_bot_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM flow_bots WHERE flow_id = NEW.flow_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 bots per flow allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_flow_bot_limit ON flow_bots;
CREATE TRIGGER enforce_flow_bot_limit
  BEFORE INSERT ON flow_bots
  FOR EACH ROW EXECUTE FUNCTION check_flow_bot_limit();

-- Comentarios
COMMENT ON COLUMN flow_plans.duration_days IS 'Duracao do plano em dias. NULL = vitalicio.';

-- ============================================
-- PARTE 6: USER FLOW STATE
-- ============================================

CREATE TABLE IF NOT EXISTS user_flow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  current_node_position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
    'in_progress', 
    'completed', 
    'waiting_response', 
    'waiting_payment', 
    'waiting_order_bump',
    'waiting_upsell',
    'waiting_downsell'
  )),
  metadata JSONB DEFAULT NULL,
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

COMMENT ON COLUMN user_flow_state.metadata IS 'Temporary data storage for flow state (order bump info, etc.)';

-- ============================================
-- PARTE 7: BOT USERS
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
  is_vip BOOLEAN DEFAULT FALSE,
  vip_since TIMESTAMPTZ,
  subscription_plan TEXT,
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  source TEXT DEFAULT 'start',
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_users_bot_id ON bot_users(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram ON bot_users(bot_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_funnel ON bot_users(bot_id, funnel_step);
CREATE INDEX IF NOT EXISTS idx_bot_users_subscriber ON bot_users(bot_id, is_subscriber);
CREATE INDEX IF NOT EXISTS idx_bot_users_source ON bot_users(bot_id, source);
CREATE INDEX IF NOT EXISTS idx_bot_users_is_vip ON bot_users(is_vip) WHERE is_vip = TRUE;

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
-- PARTE 8: BOT PLANS
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
-- PARTE 9: GATEWAYS E PAGAMENTOS
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
  flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  telegram_user_id TEXT,
  gateway TEXT NOT NULL,
  external_payment_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  qr_code TEXT,
  qr_code_url TEXT,
  copy_paste TEXT,
  pix_code TEXT,
  status TEXT DEFAULT 'pending',
  -- Dados do produto
  product_type TEXT DEFAULT 'main_product',
  product_name TEXT,
  payment_method TEXT DEFAULT 'pix',
  -- Dados do usuario Telegram
  telegram_user_name TEXT,
  telegram_username TEXT,
  telegram_first_name TEXT,
  telegram_last_name TEXT,
  telegram_photo_url TEXT,
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
CREATE INDEX IF NOT EXISTS idx_payments_flow_id ON payments(flow_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_telegram_user ON payments(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_product_type ON payments(product_type);
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

-- Comentarios
COMMENT ON COLUMN payments.flow_id IS 'ID do fluxo onde a venda foi gerada';
COMMENT ON COLUMN payments.product_type IS 'Type of product: main_product, order_bump, upsell, downsell';
COMMENT ON COLUMN payments.product_name IS 'Name/description of the product purchased';
COMMENT ON COLUMN payments.telegram_user_name IS 'Full name of the Telegram user';
COMMENT ON COLUMN payments.telegram_username IS 'Username (@handle) of the Telegram user';
COMMENT ON COLUMN payments.payment_method IS 'Payment method used: pix, credit_card, boleto';
COMMENT ON COLUMN payments.pix_code IS 'PIX Copia e Cola code for the copy button functionality';

-- ============================================
-- PARTE 10: CAMPANHAS DE REMARKETING
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'concluida')),
  campaign_type TEXT NOT NULL DEFAULT 'basic' CHECK (campaign_type IN ('basic', 'complete')),
  audience_type TEXT DEFAULT 'start',
  audience TEXT DEFAULT NULL,
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

CREATE TABLE IF NOT EXISTS remarketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  audience_id TEXT NOT NULL,
  message_template TEXT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'concluida')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  open_rate DECIMAL(5, 2) DEFAULT 0,
  click_rate DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS remarketing_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  status TEXT DEFAULT 'novo',
  origem TEXT DEFAULT 'importacao',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email, bot_id)
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
CREATE INDEX IF NOT EXISTS idx_remarketing_campaigns_bot_id ON remarketing_campaigns(bot_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_campaigns_status ON remarketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_remarketing_users_user_id ON remarketing_users(user_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_users_bot_id ON remarketing_users(bot_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_users_email ON remarketing_users(email);
CREATE INDEX IF NOT EXISTS idx_remarketing_users_status ON remarketing_users(status);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE remarketing_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_all" ON campaigns;
DROP POLICY IF EXISTS "campaign_nodes_all" ON campaign_nodes;
DROP POLICY IF EXISTS "campaign_sends_all" ON campaign_sends;
DROP POLICY IF EXISTS "campaign_user_state_all" ON campaign_user_state;

CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_nodes_all" ON campaign_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_sends_all" ON campaign_sends FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_user_state_all" ON campaign_user_state FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own remarketing users" ON remarketing_users FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own remarketing users" ON remarketing_users FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own remarketing users" ON remarketing_users FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own remarketing users" ON remarketing_users FOR DELETE USING (user_id = auth.uid());

-- Comentarios
COMMENT ON COLUMN campaigns.audience_type IS 'Type of audience: start (users who started the bot) or imported (manually imported users)';
COMMENT ON COLUMN campaigns.audience IS 'Audience filter for start users: started_not_continued, not_paid, paid. NULL for imported users.';

-- ============================================
-- PARTE 11: DRAGON BIO (Sites)
-- ============================================

CREATE TABLE IF NOT EXISTS dragon_bio_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  template VARCHAR(50) DEFAULT 'minimal',
  page_type TEXT DEFAULT 'dragonbio',
  presell_type TEXT,
  
  -- Profile data
  profile_name VARCHAR(255),
  profile_bio TEXT,
  profile_image TEXT,
  
  -- Theme/colors
  primary_color VARCHAR(20) DEFAULT '#8b5cf6',
  secondary_color VARCHAR(20) DEFAULT '#0f172a',
  text_color VARCHAR(20) DEFAULT '#ffffff',
  colors JSONB DEFAULT '{
    "primary": "#000000",
    "secondary": "#ffffff",
    "accent": "#3b82f6",
    "background": "#0f172a",
    "text": "#ffffff"
  }'::jsonb,
  
  -- Page data (presell, etc)
  page_data JSONB,
  
  -- Pixel config
  pixel_config JSONB DEFAULT NULL,
  
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
  type VARCHAR(20) DEFAULT 'button',
  image TEXT,
  position INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkout_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES dragon_bio_sites(id) ON DELETE SET NULL,
  email TEXT,
  name TEXT,
  cpf TEXT,
  phone TEXT,
  amount DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dragon_bio_sites_user_id ON dragon_bio_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_dragon_bio_sites_slug ON dragon_bio_sites(slug);
CREATE INDEX IF NOT EXISTS idx_dragon_bio_sites_pixel ON dragon_bio_sites((pixel_config IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_dragon_bio_links_site_id ON dragon_bio_links(site_id);
CREATE INDEX IF NOT EXISTS idx_checkout_leads_site_id ON checkout_leads(site_id);
CREATE INDEX IF NOT EXISTS idx_checkout_leads_created_at ON checkout_leads(created_at DESC);

ALTER TABLE dragon_bio_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE dragon_bio_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dragon_bio_sites_all" ON dragon_bio_sites;
DROP POLICY IF EXISTS "dragon_bio_links_all" ON dragon_bio_links;

CREATE POLICY "dragon_bio_sites_all" ON dragon_bio_sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dragon_bio_links_all" ON dragon_bio_links FOR ALL USING (true) WITH CHECK (true);

-- Checkout leads policies
DROP POLICY IF EXISTS "Allow public inserts" ON checkout_leads;
DROP POLICY IF EXISTS "Allow authenticated reads" ON checkout_leads;
DROP POLICY IF EXISTS "Service role full access" ON checkout_leads;

CREATE POLICY "Allow public inserts" ON checkout_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow authenticated reads" ON checkout_leads FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access" ON checkout_leads FOR ALL TO service_role USING (true);

-- Triggers para atualizar updated_at
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

-- Comentarios
COMMENT ON COLUMN dragon_bio_sites.page_data IS 'Dados de configuracao da pagina presell (ageData, thankYouData, redirectData)';
COMMENT ON COLUMN dragon_bio_sites.presell_type IS 'Tipo de presell: age-verification, thank-you, redirect';
COMMENT ON COLUMN dragon_bio_sites.pixel_config IS 'Configuracao de pixel de rastreamento (Meta/Facebook ou UTMify)';

-- ============================================
-- PARTE 12: VIP GROUPS E BOT GROUPS
-- ============================================

CREATE TABLE IF NOT EXISTS vip_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'supergroup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_id)
);

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

CREATE TABLE IF NOT EXISTS bot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  chat_type TEXT NOT NULL DEFAULT 'group',
  is_admin BOOLEAN DEFAULT false,
  can_invite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_vip_groups_bot_id ON vip_groups(bot_id);
CREATE INDEX IF NOT EXISTS idx_vip_invites_bot_id ON vip_invites(bot_id);
CREATE INDEX IF NOT EXISTS idx_vip_invites_telegram_user ON vip_invites(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_vip_invites_used ON vip_invites(used);
CREATE INDEX IF NOT EXISTS idx_bot_groups_bot_id ON bot_groups(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_groups_chat_id ON bot_groups(chat_id);

ALTER TABLE vip_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own vip_groups" ON vip_groups;
DROP POLICY IF EXISTS "Users can insert own vip_groups" ON vip_groups;
DROP POLICY IF EXISTS "Users can update own vip_groups" ON vip_groups;
DROP POLICY IF EXISTS "Users can delete own vip_groups" ON vip_groups;
DROP POLICY IF EXISTS "Anon can read vip_groups" ON vip_groups;

CREATE POLICY "Users can view own vip_groups" ON vip_groups 
  FOR SELECT USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_groups.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can insert own vip_groups" ON vip_groups 
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_groups.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can update own vip_groups" ON vip_groups 
  FOR UPDATE USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_groups.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can delete own vip_groups" ON vip_groups 
  FOR DELETE USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_groups.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Anon can read vip_groups" ON vip_groups FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Users can view own vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Users can insert own vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Users can update own vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Anon can read vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Anon can insert vip_invites" ON vip_invites;
DROP POLICY IF EXISTS "Anon can update vip_invites" ON vip_invites;

CREATE POLICY "Users can view own vip_invites" ON vip_invites 
  FOR SELECT USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_invites.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can insert own vip_invites" ON vip_invites 
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_invites.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can update own vip_invites" ON vip_invites 
  FOR UPDATE USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = vip_invites.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Anon can read vip_invites" ON vip_invites FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert vip_invites" ON vip_invites FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update vip_invites" ON vip_invites FOR UPDATE TO anon USING (true);

CREATE POLICY "Users can view their bot groups" ON bot_groups 
  FOR SELECT USING (bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid()));

CREATE POLICY "Service can manage bot groups" ON bot_groups 
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON bot_groups TO authenticated;
GRANT ALL ON bot_groups TO service_role;

-- ============================================
-- PARTE 13: SUBSCRIPTION NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id UUID NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  days_before INTEGER,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_notifications_bot_user 
  ON subscription_notifications(bot_user_id, notification_type, subscription_expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_notifications_unique 
  ON subscription_notifications(bot_user_id, flow_id, notification_type, days_before, DATE(subscription_expires_at));

-- ============================================
-- PARTE 14: BOT MESSAGES
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_bot_messages_bot_id ON bot_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_telegram_user_id ON bot_messages(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created_at ON bot_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_messages_bot_user ON bot_messages(bot_id, telegram_user_id);

ALTER TABLE bot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their bots" ON bot_messages
  FOR SELECT USING (bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid()));

CREATE POLICY "Service can insert messages" ON bot_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update messages from their bots" ON bot_messages
  FOR UPDATE USING (bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid()));

-- ============================================
-- PARTE 15: SCHEDULED MESSAGES (Upsell/Downsell)
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('upsell', 'downsell')),
  sequence_id TEXT NOT NULL,
  sequence_index INTEGER NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_bot_id ON scheduled_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user ON scheduled_messages(telegram_user_id, bot_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending ON scheduled_messages(status, scheduled_for) WHERE status = 'pending';

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their scheduled messages" ON scheduled_messages
  FOR SELECT USING (bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their scheduled messages" ON scheduled_messages
  FOR INSERT WITH CHECK (bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their scheduled messages" ON scheduled_messages
  FOR UPDATE USING (bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage all scheduled messages" ON scheduled_messages
  FOR ALL USING (true) WITH CHECK (true);

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

-- ============================================
-- PARTE 16: DEBUG LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  telegram_user_id TEXT,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_logs_category ON debug_logs(category);
CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON debug_logs(level);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debug_logs_telegram_user ON debug_logs(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_bot ON debug_logs(bot_id);

-- ============================================
-- PARTE 17: PLATFORM SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Inserir configuracoes padrao
INSERT INTO platform_settings (key, value) VALUES 
('terms_of_use', '{"sections": [
  {"title": "1. Aceitacao dos Termos", "content": "Ao acessar ou utilizar a plataforma DRAGON, o usuario declara que leu, compreendeu e concorda com todos os termos."},
  {"title": "2. Elegibilidade", "content": "E obrigatorio ter 18 anos ou mais. O uso por menores e estritamente proibido."},
  {"title": "3. Uso da Plataforma", "content": "O usuario concorda em nao utilizar a plataforma para atividades ilegais, nao fraudar pagamentos, nao burlar sistemas e nao usar bots ou automacoes indevidas."},
  {"title": "4. Conta do Usuario", "content": "O usuario e responsavel pela seguranca da conta. A DRAGON pode suspender contas suspeitas. E proibido compartilhar contas."},
  {"title": "5. Politica de Conteudo", "content": "A DRAGON proibe totalmente conteudo com menores de 18 anos, violencia extrema, conteudo ilegal, fraudes e golpes."},
  {"title": "6. Pagamentos e Taxas", "content": "Taxa fixa de R$0,50 por venda. Pagamentos sao processados por terceiros. Saques podem ter prazo de processamento."},
  {"title": "7. Penalidades", "content": "Em caso de violacao: remocao de conteudo, suspensao da conta, banimento permanente, retencao de saldo e acao legal."},
  {"title": "8. Privacidade (LGPD)", "content": "Coletamos: nome, email, dados de pagamento e dados de navegacao. O usuario pode solicitar exclusao de dados."}
]}'::jsonb),
('privacy_policy', '{"sections": [
  {"title": "1. Coleta de Dados", "content": "Coletamos informacoes que voce fornece diretamente, como nome, email, telefone e dados de pagamento."},
  {"title": "2. Uso dos Dados", "content": "Usamos seus dados para processar transacoes, melhorar nossos servicos e enviar comunicacoes relevantes."},
  {"title": "3. Compartilhamento", "content": "Nao vendemos seus dados. Compartilhamos apenas com parceiros essenciais para operacao da plataforma."},
  {"title": "4. Seus Direitos", "content": "Voce pode acessar, corrigir ou excluir seus dados a qualquer momento."},
  {"title": "5. Seguranca", "content": "Utilizamos criptografia e outras medidas para proteger seus dados."}
]}'::jsonb),
('platform_fees', '{"transaction_fee": 0.50, "withdrawal_fee": 0, "minimum_withdrawal": 10}'::jsonb),
('awards_thresholds', '{"bronze": 10000, "silver": 50000, "gold": 100000, "diamond": 500000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- PARTE 18: STORAGE BUCKETS
-- ============================================

-- Bucket flow-media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flow-media',
  'flow-media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'];

-- Bucket flow-medias (alternativo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flow-medias',
  'flow-medias',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket media
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies para evitar conflitos
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

-- Policies para flow-media
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

-- Policies para media bucket
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

-- Policies para flow-medias bucket
CREATE POLICY "Allow authenticated uploads flow-medias" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'flow-medias');

CREATE POLICY "Allow public read flow-medias" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'flow-medias');

CREATE POLICY "Allow delete own files flow-medias" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'flow-medias');

-- ============================================
-- FIM DO SETUP COMPLETO
-- ============================================
-- Este script e auto-suficiente e cria toda a estrutura
-- necessaria para o funcionamento do Dragon/TeleFlow.
-- ==============================================
