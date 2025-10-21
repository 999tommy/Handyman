-- =====================================================
-- HANDYMAN MARKETPLACE - SUPABASE DATABASE SCHEMA
-- =====================================================
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for geolocation (required for distance queries)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('customer', 'artisan', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE artisan_approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE job_status AS ENUM ('draft', 'posted', 'offers_received', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed');
CREATE TYPE service_type AS ENUM ('onsite', 'online');
CREATE TYPE time_preference AS ENUM ('morning', 'midday', 'afternoon', 'evening', 'flexible');
CREATE TYPE date_preference AS ENUM ('on_date', 'before_date', 'flexible');
CREATE TYPE offer_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE payment_status AS ENUM ('pending', 'held', 'released', 'refunded', 'failed');
CREATE TYPE message_type AS ENUM ('text', 'image', 'system');
CREATE TYPE notification_type AS ENUM ('new_job', 'offer_received', 'offer_accepted', 'offer_rejected', 'job_assigned', 'job_started', 'job_completed', 'job_cancelled', 'payment_received', 'new_message', 'review_received');

-- =====================================================
-- PROFILES & USERS
-- =====================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  phone_verified BOOLEAN DEFAULT FALSE,
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_jobs_posted INTEGER DEFAULT 0,
  total_spent DECIMAL(12, 2) DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  icon_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE artisans (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tagline VARCHAR(255),
  profession VARCHAR(100) NOT NULL,
  category_id UUID REFERENCES categories(id),
  years_experience INTEGER,
  description TEXT,
  skills TEXT[],
  base_rate DECIMAL(10, 2),
  government_id_url TEXT,
  verification_status verification_status DEFAULT 'pending',
  approval_status artisan_approval_status DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  bank_name VARCHAR(100),
  account_number VARCHAR(20),
  account_name VARCHAR(255),
  total_jobs_completed INTEGER DEFAULT 0,
  total_earnings DECIMAL(12, 2) DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- LOCATION & AVAILABILITY
-- =====================================================

CREATE TABLE artisan_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  workstation_address TEXT NOT NULL,
  street VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Nigeria',
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geography GEOGRAPHY(POINT),
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_live_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy FLOAT,
  geography GEOGRAPHY(POINT),
  is_online BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE artisan_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- JOBS & OFFERS
-- =====================================================

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  budget DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  date_preference date_preference NOT NULL,
  preferred_date DATE,
  deadline_date DATE,
  time_preference time_preference,
  needs_specific_time BOOLEAN DEFAULT FALSE,
  service_type service_type NOT NULL,
  street VARCHAR(255),
  city VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geography GEOGRAPHY(POINT),
  status job_status DEFAULT 'posted',
  assigned_artisan_id UUID REFERENCES artisans(id),
  assigned_at TIMESTAMP,
  total_offers INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  upload_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  proposed_price DECIMAL(10, 2) NOT NULL,
  cover_letter TEXT NOT NULL,
  estimated_duration VARCHAR(50),
  status offer_status DEFAULT 'pending',
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, artisan_id)
);

-- =====================================================
-- PAYMENTS
-- =====================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  artisan_id UUID REFERENCES artisans(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  platform_fee DECIMAL(10, 2),
  artisan_payout DECIMAL(10, 2),
  status payment_status DEFAULT 'pending',
  transaction_reference VARCHAR(255) UNIQUE,
  gateway_response JSONB,
  held_at TIMESTAMP,
  released_at TIMESTAMP,
  refunded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- CHAT & MESSAGING
-- =====================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  artisan_id UUID REFERENCES artisans(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, customer_id, artisan_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  message_type message_type DEFAULT 'text',
  content TEXT NOT NULL,
  image_url TEXT,
  system_event VARCHAR(50),
  system_metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- REVIEWS
-- =====================================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id),
  reviewee_id UUID REFERENCES profiles(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment TEXT,
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, reviewer_id)
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  job_id UUID REFERENCES jobs(id),
  offer_id UUID REFERENCES offers(id),
  conversation_id UUID REFERENCES conversations(id),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(10) CHECK (platform IN ('ios', 'android')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- =====================================================
-- PORTFOLIO
-- =====================================================

CREATE TABLE artisan_portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  upload_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Geolocation indexes (PostGIS)
CREATE INDEX idx_artisan_locations_geography ON artisan_locations USING GIST(geography);
CREATE INDEX idx_jobs_geography ON jobs USING GIST(geography);
CREATE INDEX idx_live_locations_geography ON user_live_locations USING GIST(geography);

-- Query optimization indexes
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_category ON jobs(category_id);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_offers_job ON offers(job_id);
CREATE INDEX idx_offers_artisan ON offers(artisan_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_artisans_approval ON artisans(approval_status);
CREATE INDEX idx_artisans_category ON artisans(category_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_artisans_updated_at BEFORE UPDATE ON artisans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-reject other offers when one is accepted
CREATE OR REPLACE FUNCTION reject_other_offers()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    UPDATE offers 
    SET status = 'rejected', rejected_at = NOW()
    WHERE job_id = NEW.job_id 
    AND id != NEW.id 
    AND status = 'pending';
    
    UPDATE jobs 
    SET status = 'assigned', 
        assigned_artisan_id = NEW.artisan_id,
        assigned_at = NOW()
    WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_reject_offers AFTER UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION reject_other_offers();

-- Update artisan average rating
CREATE OR REPLACE FUNCTION update_artisan_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE artisans
  SET average_rating = (
    SELECT AVG(rating) FROM reviews WHERE reviewee_id = NEW.reviewee_id
  ),
  total_reviews = (
    SELECT COUNT(*) FROM reviews WHERE reviewee_id = NEW.reviewee_id
  )
  WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_after_review AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_artisan_rating();

-- =====================================================
-- SEED DATA (Optional - for testing)
-- =====================================================

-- Insert default categories
INSERT INTO categories (name, description) VALUES
  ('Carpentry', 'Wood work, furniture, installations'),
  ('Plumbing', 'Pipe work, fixtures, repairs'),
  ('Electrical', 'Wiring, installations, repairs'),
  ('Cleaning', 'Home and office cleaning services'),
  ('Painting', 'Interior and exterior painting'),
  ('HVAC', 'Heating, ventilation, air conditioning'),
  ('Landscaping', 'Garden and outdoor maintenance'),
  ('Masonry', 'Brickwork, concrete, stonework');

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Enable RLS on all tables for security
-- Note: Configure policies based on your specific requirements

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisans ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Example RLS Policy
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- =====================================================
-- DONE!
-- =====================================================
