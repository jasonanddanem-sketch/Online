-- Add rules column to groups table (text array, nullable)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS rules TEXT[] DEFAULT NULL;
