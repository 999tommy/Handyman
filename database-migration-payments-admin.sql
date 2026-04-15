-- =====================================================
-- HANDYMAN MARKETPLACE - PAYMENTS + ADMIN ENHANCEMENTS
-- =====================================================
-- Run this after the base schema to add webhook/audit tables
-- =====================================================

-- Payment events table (Paystack webhooks)
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  paystack_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_status TEXT,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(paystack_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id
  ON payment_events(payment_id);

-- Admin audit logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id
  ON admin_audit_logs(admin_id);

-- Payment override metadata
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS platform_fee_override DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS artisan_payout_override DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS admin_override_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS admin_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_override_at TIMESTAMP;

-- Ensure updated_at stays fresh
CREATE OR REPLACE FUNCTION touch_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION touch_payments_updated_at();
