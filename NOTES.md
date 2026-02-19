# My Notes

## Album System (added 2026-02-19)

### Schema
```sql
-- albums: id (UUID PK), user_id (FK profiles), title (TEXT), created_at
-- album_photos: id (UUID PK), album_id (FK albums), photo_url (TEXT), created_at
-- UNIQUE constraint on (album_id, photo_url) prevents duplicates
-- Photos stay in posts table — album_photos just references URLs
```

### Supabase Functions (js/supabase.js)
- `sbGetAlbums(userId)` — returns albums with nested album_photos for any user
- `sbCreateAlbum(userId, title)` — creates album, returns row
- `sbDeleteAlbum(albumId)` — cascade deletes album + photos
- `sbRenameAlbum(albumId, title)` — updates title
- `sbAddPhotoToAlbum(albumId, photoUrl)` — upsert (no duplicate error)
- `sbRemovePhotoFromAlbum(albumPhotoId)` — deletes junction row

### RLS Policies
- Albums + album_photos: public SELECT, owner-only INSERT/UPDATE/DELETE
- album_photos INSERT/DELETE checks album ownership via subquery

### Profile View Changes
- Albums tab shown for ALL users (own + others), not just isMe
- `_pvAlbums` loaded via `sbGetAlbums(userId)` on profile load
- `_pvPostPhotos` loaded from Supabase posts for other users
- Default tab changed to "Albums" (was "Photos")

### Album Cards (profile sidebar)
- Cover image = first photo in album
- Shows title + photo count
- Click opens album view modal
- Drag photo onto card → inserts album_photos record (no duplication)
- Visual hover feedback: border highlight + slight scale

### Photo "..." Menu
- Each post photo has a "..." overlay button (top-right, visible on hover)
- Options: "Add to Album" (opens album selector modal)
- Inside album view: "Remove from Album"
- Album selector lists all user's albums, with "Create New Album" option

### Drag & Drop
- Post photos are `draggable="true"` with `data-psrc` attribute
- Album cards listen for `dragover` (prevent default, add `.drag-over` class)
- On `drop`: read `text/plain` data, call `sbAddPhotoToAlbum`, refresh albums
- `.drag-over` CSS: solid border, purple tint background, slight scale-up

### Layout
- Albums tab appears FIRST (left) in the tabs, Photos tab second
- In full "View All" page: albums listed ABOVE profile/cover/post photos

### Migration
- Run `supabase/add-albums.sql` in Supabase SQL Editor for existing deployments
- Full schema also updated in `supabase/schema.sql`
