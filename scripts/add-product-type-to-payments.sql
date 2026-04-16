-- Migration: Add missing columns to payments table for financial panel
-- This adds columns to store Telegram user data and product information

-- Product type: main_product, order_bump, upsell, downsell
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'main_product';

-- Product name (description of what was purchased)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Telegram user name (first_name + last_name)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS telegram_user_name TEXT;

-- Telegram username (@username)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS telegram_username TEXT;

-- Payment method (pix, credit_card, boleto)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix';

-- Add comments for documentation
COMMENT ON COLUMN payments.product_type IS 'Type of product: main_product, order_bump, upsell, downsell';
COMMENT ON COLUMN payments.product_name IS 'Name/description of the product purchased';
COMMENT ON COLUMN payments.telegram_user_name IS 'Full name of the Telegram user';
COMMENT ON COLUMN payments.telegram_username IS 'Username (@handle) of the Telegram user';
COMMENT ON COLUMN payments.payment_method IS 'Payment method used: pix, credit_card, boleto';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_telegram_user ON payments(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_product_type ON payments(product_type);
