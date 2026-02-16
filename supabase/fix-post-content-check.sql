-- =============================================================================
-- BlipVibe — Fix post_content_check constraint for photo-only posts
-- Paste this into Supabase SQL Editor and click "Run"
-- =============================================================================

-- Drop ALL check constraints on the posts.content column
-- (The constraint name varies depending on which schema file created the table)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
      AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.posts'::regclass
      AND con.contype = 'c'
      AND att.attname = 'content'
  LOOP
    EXECUTE 'ALTER TABLE public.posts DROP CONSTRAINT ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- Ensure the column allows empty strings (keep NOT NULL, just remove length check)
-- Content can be empty when a post is image-only
ALTER TABLE public.posts ALTER COLUMN content SET DEFAULT '';

-- Verify: this should return 0 rows (no check constraints left on content)
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.posts'::regclass AND contype = 'c';
