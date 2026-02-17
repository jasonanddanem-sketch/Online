-- Add email column to profiles table for username-based login lookup
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

-- Backfill existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
