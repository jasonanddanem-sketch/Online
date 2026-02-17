-- Add terms_accepted column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;
