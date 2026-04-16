-- Desabilitar RLS nas tabelas principais para permitir operacoes do backend

ALTER TABLE IF EXISTS bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS flows DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS flow_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS flow_bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS referrals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bot_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vip_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_members DISABLE ROW LEVEL SECURITY;

-- Confirmar que RLS foi desabilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('bots', 'flows', 'flow_nodes', 'flow_bots', 'leads', 'users', 'subscriptions', 'referrals', 'bot_groups', 'vip_groups', 'group_members');
