-- =====================================================
-- HANDYMAN MARKETPLACE - ARTISAN WITHDRAWALS MIGRATION
-- =====================================================

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  bank_name VARCHAR(100) NOT NULL,
  bank_account_number VARCHAR(20) NOT NULL,
  account_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  reference VARCHAR(255) UNIQUE,
  transfer_code VARCHAR(255),
  recipient_code VARCHAR(255),
  admin_note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_artisan_id
  ON withdrawals(artisan_id);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status
  ON withdrawals(status);
