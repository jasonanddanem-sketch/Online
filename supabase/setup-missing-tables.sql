-- =============================================================================
-- BlipVibe — Create any missing tables & policies (safe to run multiple times)
-- Paste this into Supabase SQL Editor and click "Run"
-- =============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Enum types (safe — handles duplicates)
DO $$ BEGIN CREATE TYPE public.group_role AS ENUM ('member', 'moderator', 'admin', 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.like_target_type AS ENUM ('post', 'comment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_type AS ENUM ('comment', 'reply', 'like', 'follow', 'purchase', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.coin_tx_reason AS ENUM ('post_created', 'comment_created', 'reply_created', 'like_received', 'follow_received', 'skin_purchase', 'group_skin_purchase', 'group_contribution', 'admin_grant', 'admin_deduct'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tables (IF NOT EXISTS = safe to re-run)

CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username        TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    bio             TEXT DEFAULT '',
    avatar_url      TEXT,
    cover_photo_url TEXT,
    coin_balance    INTEGER NOT NULL DEFAULT 1000 CHECK (coin_balance >= 0),
    is_premium      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

CREATE TABLE IF NOT EXISTS public.follows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT follows_no_self CHECK (follower_id <> followed_id),
    CONSTRAINT follows_unique UNIQUE (follower_id, followed_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON public.follows (followed_id);

CREATE TABLE IF NOT EXISTS public.groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    avatar_url      TEXT,
    cover_photo_url TEXT,
    owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coin_balance    INTEGER NOT NULL DEFAULT 1000 CHECK (coin_balance >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_groups_owner ON public.groups (owner_id);

CREATE TABLE IF NOT EXISTS public.group_members (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role       public.group_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT group_members_unique UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON public.group_members (user_id);

CREATE TABLE IF NOT EXISTS public.posts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id   UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    content    TEXT NOT NULL CHECK (char_length(content) > 0),
    image_url  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_author  ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_group   ON public.posts (group_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id           UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    content           TEXT NOT NULL CHECK (char_length(content) > 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post   ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments (author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments (parent_comment_id);

CREATE TABLE IF NOT EXISTS public.likes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type public.like_target_type NOT NULL,
    target_id   UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT likes_unique UNIQUE (user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_user   ON public.likes (user_id);
CREATE INDEX IF NOT EXISTS idx_likes_target ON public.likes (target_type, target_id);

CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type        public.notification_type NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    data        JSONB DEFAULT '{}',
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user      ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON public.notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    group_id   UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    amount     INTEGER NOT NULL,
    reason     public.coin_tx_reason NOT NULL,
    ref_id     UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user   ON public.coin_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_group  ON public.coin_transactions (group_id);

CREATE TABLE IF NOT EXISTS public.coin_guards (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    guard_type TEXT NOT NULL,
    ref_id     UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT coin_guards_unique UNIQUE (user_id, guard_type, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_coin_guards_user ON public.coin_guards (user_id);

CREATE TABLE IF NOT EXISTS public.coin_config (
    key        TEXT PRIMARY KEY,
    value      INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.coin_config (key, value) VALUES
    ('coins_per_post', 10), ('coins_per_comment', 5),
    ('coins_per_reply', 3), ('max_posts_per_session', 1)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.skins (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT NOT NULL,
    description          TEXT DEFAULT '',
    preview_url          TEXT,
    background_image_url TEXT,
    saturation           NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    price_coins          INTEGER NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_skins (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skin_id    UUID NOT NULL REFERENCES public.skins(id) ON DELETE CASCADE,
    is_active  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_skins_unique UNIQUE (user_id, skin_id)
);
CREATE INDEX IF NOT EXISTS idx_user_skins_user ON public.user_skins (user_id);

CREATE TABLE IF NOT EXISTS public.group_skins (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    skin_id    UUID NOT NULL REFERENCES public.skins(id) ON DELETE CASCADE,
    is_active  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT group_skins_unique UNIQUE (group_id, skin_id)
);
CREATE INDEX IF NOT EXISTS idx_group_skins_group ON public.group_skins (group_id);


-- 3. Triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_comments_updated_at ON public.comments;
CREATE TRIGGER set_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_groups_updated_at ON public.groups;
CREATE TRIGGER set_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_skins_updated_at ON public.skins;
CREATE TRIGGER set_skins_updated_at BEFORE UPDATE ON public.skins FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_coin_config_updated_at ON public.coin_config;
CREATE TRIGGER set_coin_config_updated_at BEFORE UPDATE ON public.coin_config FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, bio, avatar_url, cover_photo_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        '', NULL, NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 4. Enable RLS on all tables
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_guards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_skins       ENABLE ROW LEVEL SECURITY;


-- 5. RLS Policies (DROP + CREATE to avoid "already exists" errors)

-- PROFILES
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- FOLLOWS
DROP POLICY IF EXISTS follows_select ON public.follows;
CREATE POLICY follows_select ON public.follows FOR SELECT USING (true);
DROP POLICY IF EXISTS follows_insert ON public.follows;
CREATE POLICY follows_insert ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS follows_delete ON public.follows;
CREATE POLICY follows_delete ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- GROUPS
DROP POLICY IF EXISTS groups_select ON public.groups;
CREATE POLICY groups_select ON public.groups FOR SELECT USING (true);
DROP POLICY IF EXISTS groups_insert ON public.groups;
CREATE POLICY groups_insert ON public.groups FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS groups_update ON public.groups;
CREATE POLICY groups_update ON public.groups FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS groups_delete ON public.groups;
CREATE POLICY groups_delete ON public.groups FOR DELETE USING (auth.uid() = owner_id);

-- GROUP MEMBERS
DROP POLICY IF EXISTS group_members_select ON public.group_members;
CREATE POLICY group_members_select ON public.group_members FOR SELECT USING (true);
DROP POLICY IF EXISTS group_members_insert ON public.group_members;
CREATE POLICY group_members_insert ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
DROP POLICY IF EXISTS group_members_delete ON public.group_members;
CREATE POLICY group_members_delete ON public.group_members FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
DROP POLICY IF EXISTS group_members_update ON public.group_members;
CREATE POLICY group_members_update ON public.group_members FOR UPDATE USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

-- POSTS
DROP POLICY IF EXISTS posts_select ON public.posts;
CREATE POLICY posts_select ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS posts_insert ON public.posts;
CREATE POLICY posts_insert ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS posts_update ON public.posts;
CREATE POLICY posts_update ON public.posts FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS posts_delete ON public.posts;
CREATE POLICY posts_delete ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- COMMENTS
DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS comments_update ON public.comments;
CREATE POLICY comments_update ON public.comments FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS comments_delete ON public.comments;
CREATE POLICY comments_delete ON public.comments FOR DELETE USING (auth.uid() = author_id);

-- LIKES
DROP POLICY IF EXISTS likes_select ON public.likes;
CREATE POLICY likes_select ON public.likes FOR SELECT USING (true);
DROP POLICY IF EXISTS likes_insert ON public.likes;
CREATE POLICY likes_insert ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS likes_delete ON public.likes;
CREATE POLICY likes_delete ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- NOTIFICATIONS
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- COIN TRANSACTIONS
DROP POLICY IF EXISTS coin_tx_select ON public.coin_transactions;
CREATE POLICY coin_tx_select ON public.coin_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS coin_tx_insert ON public.coin_transactions;
CREATE POLICY coin_tx_insert ON public.coin_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- COIN GUARDS
DROP POLICY IF EXISTS coin_guards_select ON public.coin_guards;
CREATE POLICY coin_guards_select ON public.coin_guards FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS coin_guards_insert ON public.coin_guards;
CREATE POLICY coin_guards_insert ON public.coin_guards FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- COIN CONFIG
DROP POLICY IF EXISTS coin_config_select ON public.coin_config;
CREATE POLICY coin_config_select ON public.coin_config FOR SELECT USING (true);

-- SKINS
DROP POLICY IF EXISTS skins_select ON public.skins;
CREATE POLICY skins_select ON public.skins FOR SELECT USING (true);

-- USER SKINS
DROP POLICY IF EXISTS user_skins_select ON public.user_skins;
CREATE POLICY user_skins_select ON public.user_skins FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_skins_insert ON public.user_skins;
CREATE POLICY user_skins_insert ON public.user_skins FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS user_skins_update ON public.user_skins;
CREATE POLICY user_skins_update ON public.user_skins FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- GROUP SKINS
DROP POLICY IF EXISTS group_skins_select ON public.group_skins;
CREATE POLICY group_skins_select ON public.group_skins FOR SELECT USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_skins.group_id AND gm.user_id = auth.uid()));
DROP POLICY IF EXISTS group_skins_insert ON public.group_skins;
CREATE POLICY group_skins_insert ON public.group_skins FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
DROP POLICY IF EXISTS group_skins_update ON public.group_skins;
CREATE POLICY group_skins_update ON public.group_skins FOR UPDATE USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_skins.group_id AND g.owner_id = auth.uid()));


-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.award_coins(
    p_user_id UUID, p_amount INTEGER, p_reason public.coin_tx_reason,
    p_guard_type TEXT DEFAULT NULL, p_ref_id UUID DEFAULT NULL, p_group_id UUID DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_guard_type IS NOT NULL AND p_ref_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.coin_guards WHERE user_id = p_user_id AND guard_type = p_guard_type AND ref_id = p_ref_id) THEN RETURN FALSE; END IF;
        INSERT INTO public.coin_guards (user_id, guard_type, ref_id) VALUES (p_user_id, p_guard_type, p_ref_id);
    END IF;
    INSERT INTO public.coin_transactions (user_id, group_id, amount, reason, ref_id) VALUES (p_user_id, p_group_id, p_amount, p_reason, p_ref_id);
    UPDATE public.profiles SET coin_balance = coin_balance + p_amount WHERE id = p_user_id;
    IF p_group_id IS NOT NULL THEN UPDATE public.groups SET coin_balance = coin_balance + p_amount WHERE id = p_group_id; END IF;
    RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.purchase_group_skin(p_group_id UUID, p_skin_id UUID, p_buyer_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_price INTEGER; v_balance INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id = p_group_id AND owner_id = p_buyer_id) THEN RAISE EXCEPTION 'Only the group owner can purchase skins'; END IF;
    SELECT price_coins INTO v_price FROM public.skins WHERE id = p_skin_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Skin not found'; END IF;
    SELECT coin_balance INTO v_balance FROM public.groups WHERE id = p_group_id FOR UPDATE;
    IF v_balance < v_price THEN RAISE EXCEPTION 'Insufficient group coins'; END IF;
    UPDATE public.groups SET coin_balance = coin_balance - v_price WHERE id = p_group_id;
    INSERT INTO public.coin_transactions (group_id, amount, reason, ref_id) VALUES (p_group_id, -v_price, 'group_skin_purchase', p_skin_id);
    INSERT INTO public.group_skins (group_id, skin_id) VALUES (p_group_id, p_skin_id) ON CONFLICT DO NOTHING;
    RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.purchase_user_skin(p_user_id UUID, p_skin_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_price INTEGER; v_balance INTEGER;
BEGIN
    SELECT price_coins INTO v_price FROM public.skins WHERE id = p_skin_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Skin not found'; END IF;
    SELECT coin_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF v_balance < v_price THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
    UPDATE public.profiles SET coin_balance = coin_balance - v_price WHERE id = p_user_id;
    INSERT INTO public.coin_transactions (user_id, amount, reason, ref_id) VALUES (p_user_id, -v_price, 'skin_purchase', p_skin_id);
    INSERT INTO public.user_skins (user_id, skin_id) VALUES (p_user_id, p_skin_id) ON CONFLICT DO NOTHING;
    RETURN TRUE;
END; $$;


-- 7. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Public read posts" ON storage.objects;
CREATE POLICY "Public read posts" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
DROP POLICY IF EXISTS "Auth upload avatars" ON storage.objects;
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth upload posts" ON storage.objects;
CREATE POLICY "Auth upload posts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth update avatars" ON storage.objects;
CREATE POLICY "Auth update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth update posts" ON storage.objects;
CREATE POLICY "Auth update posts" ON storage.objects FOR UPDATE USING (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- DONE! All tables, policies, triggers, and storage are set up.
