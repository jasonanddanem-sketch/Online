-- Photo Comments: per-photo commenting in lightbox
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS photo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url TEXT NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES photo_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_comments_url ON photo_comments(photo_url);
CREATE INDEX IF NOT EXISTS idx_photo_comments_author ON photo_comments(author_id);

-- RLS
ALTER TABLE photo_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read photo comments"
  ON photo_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert photo comments"
  ON photo_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete own photo comments"
  ON photo_comments FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can update own photo comments"
  ON photo_comments FOR UPDATE
  USING (auth.uid() = author_id);
