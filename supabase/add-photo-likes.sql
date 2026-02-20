-- Photo Likes/Dislikes: per-photo reactions in lightbox
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS photo_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(photo_url, user_id)
);

CREATE INDEX IF NOT EXISTS idx_photo_likes_url ON photo_likes(photo_url);
CREATE INDEX IF NOT EXISTS idx_photo_likes_user ON photo_likes(user_id);

-- RLS
ALTER TABLE photo_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read photo likes"
  ON photo_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert photo likes"
  ON photo_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own photo likes"
  ON photo_likes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own photo likes"
  ON photo_likes FOR DELETE
  USING (auth.uid() = user_id);
