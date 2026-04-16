-- Platform settings table for admin configurations
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Insert default terms
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
