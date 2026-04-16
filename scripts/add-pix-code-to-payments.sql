-- Add pix_code column to payments table for storing the PIX copia e cola code
-- This enables the copy button functionality

ALTER TABLE payments ADD COLUMN IF NOT EXISTS pix_code TEXT;

-- Update existing records that have copy_paste but not pix_code
UPDATE payments SET pix_code = copy_paste WHERE pix_code IS NULL AND copy_paste IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN payments.pix_code IS 'PIX Copia e Cola code for the copy button functionality';
