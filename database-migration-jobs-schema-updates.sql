-- =====================================================
-- DATABASE MIGRATION: MAKE JOBS FIELDS OPTIONAL
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- This updates column constraints for the jobs table to support the new optional fields

ALTER TABLE jobs ALTER COLUMN title DROP NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN jobs.title IS 'Job title, now optional (nullable) as requested. Enforced optionally on the frontend.';
