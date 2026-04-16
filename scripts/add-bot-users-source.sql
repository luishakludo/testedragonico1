-- Add source column to bot_users table
-- This allows differentiating between users captured by bot ('start') 
-- and users imported manually ('imported')

-- Add the source column with default 'start' for existing users
ALTER TABLE bot_users 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'start';

-- Create index for faster filtering by source
CREATE INDEX IF NOT EXISTS idx_bot_users_source ON bot_users(bot_id, source);

-- Update existing users to have source = 'start' (they came from bot interaction)
UPDATE bot_users SET source = 'start' WHERE source IS NULL;
