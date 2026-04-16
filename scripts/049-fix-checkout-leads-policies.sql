-- Fix checkout_leads RLS policies to allow reading leads

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public inserts" ON checkout_leads;
DROP POLICY IF EXISTS "Service role full access" ON checkout_leads;
DROP POLICY IF EXISTS "Allow authenticated reads" ON checkout_leads;

-- Policy to allow inserts from anyone (public checkout)
CREATE POLICY "Allow public inserts" ON checkout_leads 
  FOR INSERT TO anon 
  WITH CHECK (true);

-- Policy to allow reads from authenticated users (via site ownership)
CREATE POLICY "Allow authenticated reads" ON checkout_leads 
  FOR SELECT TO anon 
  USING (true);

-- Policy to allow service role full access
CREATE POLICY "Service role full access" ON checkout_leads 
  FOR ALL TO service_role 
  USING (true);
