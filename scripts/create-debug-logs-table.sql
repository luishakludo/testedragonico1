-- Tabela para armazenar logs de debug
-- Esta tabela permite debugar o Order Bump e outros processos

CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info', -- info, warn, error, debug
  category TEXT NOT NULL DEFAULT 'general', -- order_bump, payment, upsell, webhook, flow, general
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  telegram_user_id TEXT,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_debug_logs_category ON debug_logs(category);
CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON debug_logs(level);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debug_logs_telegram_user ON debug_logs(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_bot ON debug_logs(bot_id);

-- Política para limpeza automática (logs mais antigos que 7 dias)
-- Execute manualmente ou configure um cron job:
-- DELETE FROM debug_logs WHERE created_at < NOW() - INTERVAL '7 days';
