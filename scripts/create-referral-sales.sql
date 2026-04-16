-- Create referral_sales table for tracking affiliate earnings and admin adjustments
CREATE TABLE IF NOT EXISTS referral_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'sale',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referral_sales_referrer ON referral_sales(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_sales_created ON referral_sales(created_at);

-- Enable RLS
ALTER TABLE referral_sales ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own sales
CREATE POLICY "Users can read own referral sales"
  ON referral_sales
  FOR SELECT
  USING (auth.uid() = referrer_id);

-- Policy for service role to insert (for admin adjustments)
CREATE POLICY "Service role can insert referral sales"
  ON referral_sales
  FOR INSERT
  WITH CHECK (true);

-- Policy for service role to manage all
CREATE POLICY "Service role can manage all referral sales"
  ON referral_sales
  FOR ALL
  USING (true)
  WITH CHECK (true);
