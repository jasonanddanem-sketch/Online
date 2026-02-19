-- Add albums + album_photos tables (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS public.albums (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title      TEXT NOT NULL CHECK (char_length(title) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_albums_user ON public.albums (user_id);

CREATE TABLE IF NOT EXISTS public.album_photos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id   UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
    photo_url  TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT album_photos_unique UNIQUE (album_id, photo_url)
);
CREATE INDEX IF NOT EXISTS idx_album_photos_album ON public.album_photos (album_id);

ALTER TABLE public.albums       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;

-- Albums: anyone can read, owner can write
CREATE POLICY albums_select ON public.albums FOR SELECT USING (true);
CREATE POLICY albums_insert ON public.albums FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY albums_update ON public.albums FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY albums_delete ON public.albums FOR DELETE USING (auth.uid() = user_id);

-- Album photos: anyone can read, album owner can write
CREATE POLICY album_photos_select ON public.album_photos FOR SELECT USING (true);
CREATE POLICY album_photos_insert ON public.album_photos
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid()));
CREATE POLICY album_photos_delete ON public.album_photos
    FOR DELETE USING (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_photos.album_id AND a.user_id = auth.uid()));
