-- Add audience_type and audience columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS audience_type TEXT DEFAULT 'start';

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.audience_type IS 'Type of audience: start (users who started the bot) or imported (manually imported users)';
COMMENT ON COLUMN campaigns.audience IS 'Audience filter for start users: started_not_continued, not_paid, paid. NULL for imported users.';
