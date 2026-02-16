-- Add media_urls column to posts table (text array for multi-image posts)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT NULL;
