-- =====================================================
-- DATABASE MIGRATION: NEW ONBOARDING FLOW
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- This adds support for the new customer and artisan onboarding flows

-- =====================================================
-- 1. ADD NEW COLUMNS TO PROFILES TABLE
-- =====================================================

-- Add address field for customers (plain text address)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add interested_services field for customers (array of service categories)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS interested_services TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN profiles.address IS 'Plain text address for customers (e.g., "No 3, Rajui Road Lagos Nigeria")';
COMMENT ON COLUMN profiles.interested_services IS 'Array of service categories customer is interested in';

-- =====================================================
-- 2. CREATE PHONE_VERIFICATIONS TABLE
-- =====================================================

-- This table stores SMS verification codes
CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone 
ON phone_verifications(phone_number);

-- Index for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires 
ON phone_verifications(expires_at);

-- Enable RLS
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert/update (for verification)
CREATE POLICY "Anyone can insert verification codes" 
ON phone_verifications FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update their verification attempts" 
ON phone_verifications FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can read their verification codes" 
ON phone_verifications FOR SELECT 
USING (true);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_phone_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER phone_verifications_updated_at
BEFORE UPDATE ON phone_verifications
FOR EACH ROW
EXECUTE FUNCTION update_phone_verifications_updated_at();

-- =====================================================
-- 3. CLEANUP OLD VERIFICATION CODES (OPTIONAL)
-- =====================================================

-- Function to delete expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verifications 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- You can run this manually or set up a cron job in Supabase:
-- SELECT cron.schedule('cleanup-verifications', '0 * * * *', 'SELECT cleanup_expired_verifications()');

-- =====================================================
-- 4. UPDATE ARTISANS TABLE (AUTO-APPROVAL)
-- =====================================================

-- Change default approval_status to 'approved' for new artisans
ALTER TABLE artisans 
ALTER COLUMN approval_status SET DEFAULT 'approved';

-- Change default verification_status to 'verified'
ALTER TABLE artisans 
ALTER COLUMN verification_status SET DEFAULT 'verified';

-- If you want to auto-approve all existing pending artisans (OPTIONAL):
-- UPDATE artisans 
-- SET approval_status = 'approved', verification_status = 'verified'
-- WHERE approval_status = 'pending';

-- =====================================================
-- 5. VERIFY SCHEMA CHANGES
-- =====================================================

-- Check profiles table has new columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' 
AND column_name IN ('address', 'interested_services');

-- Check phone_verifications table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'phone_verifications';

-- =====================================================
-- MIGRATION COMPLETE ✅
-- =====================================================
-- Next steps:
-- 1. Create Supabase Storage buckets (see SUPABASE_STORAGE_SETUP.md)
-- 2. Configure Twilio for SMS verification
-- 3. Test the new registration endpoints
