-- Add is_vip field to bot_users table
-- VIP users are those who purchased main products (not bumps/packs)

-- Add is_vip column
ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;

-- Add vip_since column to track when user became VIP
ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS vip_since TIMESTAMPTZ;

-- Create index for VIP queries
CREATE INDEX IF NOT EXISTS idx_bot_users_is_vip ON bot_users(is_vip) WHERE is_vip = TRUE;

-- Add subscription renewal configuration to flows
-- This will be stored in the existing config JSONB column with structure:
-- {
--   "subscription": {
--     "renewal_deliverable_id": "uuid" | null,
--     "notifications": [
--       { "days_before": 3, "time": "10:00", "message": "...", "media_url": "..." }
--     ],
--     "expiration_message": { "text": "...", "media_url": "..." },
--     "expiration_actions": {
--       "remove_vip": true,
--       "kick_from_group": true
--     }
--   }
-- }

-- Create subscription_notifications table for tracking sent notifications
CREATE TABLE IF NOT EXISTS subscription_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_user_id UUID NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'renewal_reminder', 'expiration'
    days_before INTEGER, -- for renewal reminders
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_subscription_notifications_bot_user 
ON subscription_notifications(bot_user_id, notification_type, subscription_expires_at);

-- Prevent duplicate notifications
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_notifications_unique 
ON subscription_notifications(bot_user_id, flow_id, notification_type, days_before, DATE(subscription_expires_at));
