# BlipVibe Supabase Setup Checklist

## 1. Replace placeholders in `js/supabase.js`
```js
const SUPABASE_URL  = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY_HERE';
```

## 2. Run `supabase/schema.sql` in SQL Editor
Paste the entire file into **Supabase Dashboard > SQL Editor > New Query** and run it.

## 3. Create Storage Buckets
In **Supabase Dashboard > Storage**, create two public buckets:

| Bucket   | Public |
|----------|--------|
| `avatars` | Yes   |
| `posts`   | Yes   |

For each bucket, add this RLS policy (or set to public):
```sql
CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars','posts'));
CREATE POLICY "Auth upload" ON storage.objects FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth update" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
```

## 4. Enable Email Auth
In **Authentication > Providers**, ensure **Email** is enabled.
Optionally disable "Confirm email" for faster dev testing.

## 5. Test
1. Open `index.html` in a browser
2. Click "Create an account"
3. Sign up with email + password + username
4. You should see the app with your profile loaded from Supabase
