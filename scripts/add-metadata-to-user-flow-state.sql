-- Migration: Add metadata column to user_flow_state for storing Order Bump info
-- This allows storing temporary data like order bump name/price during the flow

-- Add metadata column as JSONB for flexible data storage
ALTER TABLE user_flow_state
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Update status constraint to include new statuses for order bump and payment flows
-- First drop the old constraint
ALTER TABLE user_flow_state 
DROP CONSTRAINT IF EXISTS user_flow_state_status_check;

-- Add new constraint with all possible statuses
ALTER TABLE user_flow_state 
ADD CONSTRAINT user_flow_state_status_check 
CHECK (status IN (
  'in_progress', 
  'completed', 
  'waiting_response', 
  'waiting_payment', 
  'waiting_order_bump',
  'waiting_upsell',
  'waiting_downsell'
));

-- Add comment for documentation
COMMENT ON COLUMN user_flow_state.metadata IS 'Temporary data storage for flow state (order bump info, etc.)';
