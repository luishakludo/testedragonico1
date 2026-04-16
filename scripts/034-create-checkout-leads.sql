-- Create checkout_leads table for storing form data
CREATE TABLE IF NOT EXISTS checkout_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES dragon_bio_sites(id) ON DELETE SET NULL,
  email TEXT,
  name TEXT,
  cpf TEXT,
  phone TEXT,
  amount DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_checkout_leads_site_id ON checkout_leads(site_id);
CREATE INDEX IF NOT EXISTS idx_checkout_leads_created_at ON checkout_leads(created_at DESC);

-- Enable RLS
ALTER TABLE checkout_leads ENABLE ROW LEVEL SECURITY;

-- Policy to allow inserts from anyone (public checkout)
CREATE POLICY "Allow public inserts" ON checkout_leads FOR INSERT TO anon WITH CHECK (true);

-- Policy to allow service role full access
CREATE POLICY "Service role full access" ON checkout_leads FOR ALL TO service_role USING (true);
