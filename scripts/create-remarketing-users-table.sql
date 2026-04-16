-- Create remarketing_users table for imported users
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_remarketing_users_user_id ON remarketing_users(user_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_users_bot_id ON remarketing_users(bot_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_users_email ON remarketing_users(email);
CREATE INDEX IF NOT EXISTS idx_remarketing_users_status ON remarketing_users(status);

-- Enable RLS
ALTER TABLE remarketing_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only see their own remarketing users
CREATE POLICY "Users can view own remarketing users"
  ON remarketing_users FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own remarketing users"
  ON remarketing_users FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own remarketing users"
  ON remarketing_users FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own remarketing users"
  ON remarketing_users FOR DELETE
  USING (user_id = auth.uid());
