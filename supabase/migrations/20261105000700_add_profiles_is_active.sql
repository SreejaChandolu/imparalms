-- ====================================================================
-- IMPARA LMS: ADD IS_ACTIVE TO PROFILES TABLE
-- Migration: 20261105000700_add_profiles_is_active.sql
-- Description:
--   1. Adds is_active boolean (default true) to public.profiles.
--   2. Inactive users are rejected at login and prohibited from portal access.
-- ====================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Index for fast user activation lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
