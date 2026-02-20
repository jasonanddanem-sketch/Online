# My Notes

## Project Info
- **Name:** BlipVibe (formerly Dabble)
- **Repo:** https://github.com/jasonanddanem-sketch/Online
- **Work folder:** `C:\Users\danea\OneDrive\Desktop\Website\BlipVibe`

## Workflow Rules
- **Always push** every commit to `origin main` immediately after committing
- **Always update this file** (`NOTES.md`) whenever something changes — new features, bug fixes, structural changes
- **Always commit** after each meaningful change (don't batch unrelated changes)
- Title this file "My Notes" — no "claude" in the filename
- When starting a new session, **read this file first** to understand the full project state
- Use concise but complete descriptions so any future session can pick up where this left off

## Tech Stack
- **Frontend:** Vanilla JS, single `index.html` shell, `js/app.js` (all logic), `css/style.css` (all styling)
- **Backend:** Supabase (PostgreSQL, Auth, Storage) via `js/supabase.js`
- **Routing:** Hash-based (`#home`, `#photos`, `#shop`, etc.) with localStorage fallback for mobile
- **State:** In-memory `state` object, persisted to localStorage + Supabase `skin_data` column
- **Styling:** CSS custom properties (`--primary`, `--card`, etc.), skin/theme system, premium skins with background images
- **Pill tab pattern:** `.search-tabs` container + `.search-tab` buttons — used in Skin Shop, My Skins, Group Shop, Created Albums, Saved Posts

## Saved Posts Page (updated 2026-02-19)
- **Restructured to pill tab system** — same `.search-tab` / `.search-tabs` as Skin Shop and Created Albums
- **"All" tab** (default) shows all saved posts across all folders
- Each folder = pill button with post count badge
- Delete folder via X icon on pill (same `.album-del-x` class), Favorites cannot be deleted
- Smooth fade/slide transition between folder tabs
- Unsaving a post updates pill count badges inline without full re-render
- "New Folder" button remains in page header (existing HTML)
- `_currentSavedTab` tracks active tab, `_renderSavedTabPosts()` renders content
- `_bindSavedPageEvents()` handles tab clicks + deletes, `_bindSavedPostEvents()` handles unsave + view more

## Mobile Bottom Nav Bar (added 2026-02-19)
- Nav links (`.nav-center`) pinned to bottom of screen on all mobile/tablet (≤768px breakpoint)
- Previously only applied at ≤640px (phones), now covers tablets too
- `position:fixed;bottom:0;` with safe-area-inset for iPhone notch
- All nav styles (metro, rail, mirror, dock, pill, etc.) properly handled
- Page padding-bottom set to 72px for bottom nav clearance
- Premium nav backgrounds apply to bottom bar
- Comment button visible on each nav link with icon + label

### Comment Modal Scroll Fix (2026-02-19)
- Added `overscroll-behavior:contain` to `.comment-modal-scroll` and `.comment-post-embed`
- Prevents background page from scrolling when scrolling inside comment popup on mobile/iOS

## Per-Photo Comments (added 2026-02-19)

### Overview
- Every photo in the lightbox viewer has its own comment thread
- **Desktop:** Comment panel displayed to the right of the photo (340px wide)
- **Mobile:** Tap comment button (bottom-right) to slide up a comment sheet from the bottom

### Database
```sql
-- photo_comments: id (UUID PK), photo_url (TEXT), post_id (FK posts), author_id (FK profiles),
--   content (TEXT), parent_comment_id (FK photo_comments), created_at
-- Indexed on photo_url and author_id
```

### Supabase Functions (js/supabase.js)
- `sbGetPhotoComments(photoUrl, sortBy)` — fetch comments for a photo URL
- `sbCreatePhotoComment(photoUrl, postId, authorId, content, parentId)` — add comment
- `sbDeletePhotoComment(commentId)` — delete comment

### Lightbox Restructure
- New HTML: `.lightbox-layout` wraps `.lightbox-media` + `.lightbox-comments`
- `.lightbox-media` contains image, arrows, counter, and mobile comment toggle button
- `.lightbox-comments` has header, scrollable comment list, and input area
- Touch swipe confined to `.lightbox-media` (doesn't trigger on comment panel)
- Post ID passed through from feed posts for photo-post association
- `buildLbComment()` renders individual comments with reply/delete buttons
- `loadPhotoComments()` called on show and photo navigation
- Escape key closes comment panel first (if open), then lightbox

### Mobile Behavior
- `.lightbox-comment-toggle` button visible only on mobile (≤768px)
- Comment panel slides up from bottom with `transform:translateY` transition
- `.lb-open` class toggles the panel
- Close button in comment panel header dismisses it
- Panel has `max-height:70vh`, rounded top corners

### Migration
- Run `supabase/add-photo-comments.sql` in Supabase SQL Editor

## Per-Photo Likes/Dislikes (added 2026-02-19)

### Overview
- Like and dislike buttons in the lightbox bottom bar for every photo
- Optimistic UI — instant visual feedback, reverts on error
- Toggle: tap same reaction to remove it, tap opposite to switch

### Database
```sql
-- photo_likes: id (UUID PK), photo_url (TEXT), user_id (FK profiles),
--   reaction TEXT ('like' or 'dislike'), created_at
-- UNIQUE(photo_url, user_id) — one reaction per user per photo
```

### Supabase Functions (js/supabase.js)
- `sbTogglePhotoReaction(photoUrl, userId, reaction)` — insert/switch/remove
- `sbGetPhotoReactionCounts(photoUrl)` — returns `{likes, dislikes}`
- `sbGetUserPhotoReaction(photoUrl, userId)` — returns user's current reaction or null

### UI
- `.lightbox-bar` at bottom of `.lightbox-media` — gradient overlay for readability
- Contains: counter, like button, dislike button, comment toggle (mobile)
- Active like = primary color + filled icon, active dislike = red + filled icon
- Counts update instantly on click

### Migration
- Run `supabase/add-photo-likes.sql` in Supabase SQL Editor

## Coin System Fix (2026-02-19)
- **No coins for interacting with your own content**
- `isOwnPost(postId)` helper checks if post belongs to current user via `feedPosts`
- Covers: post likes/dislikes (feed, profile view, groups), comment likes/dislikes (modal + inline), commenting/replying on own posts
- `data-aid` attribute added to comment like/dislike buttons for author-level checking
- You can still like/dislike your own stuff — it just won't award coins

## Bug Fixes

### Tablet/iPad swipe jumping to wrong category (fixed 2026-02-19)
- **Cause:** Swipe-to-switch-tab handlers on Skin Shop, My Skins, Group Shop, and Group View fired on any horizontal swipe > 50px, conflicting with scrolling through cards in `.shop-scroll-row`
- **Fix:** Removed all four swipe-to-switch handlers — tabs are easily tappable, the gesture caused more harm than good on wider screens
- Affected: `renderShop()`, `renderMySkins()`, `renderGroupShop()`, `showGroupView()`

### Groups page defaults to My Groups tab (fixed 2026-02-19)
- `navigateTo('groups')` now resets `currentGroupTab='yours'` before rendering
- Falls back to first available tab if user has no created groups

### Mobile refresh goes to home screen (fixed 2026-02-19)
- **Cause:** iOS Safari / mobile browsers can lose URL hash on refresh, pull-to-refresh, or memory-pressure tab reload
- **Fix:** `navigateTo()` now saves current page to `localStorage` key `blipvibe_lastPage`. Three fallback points read it when hash is empty/home:
  1. Inline `index.html` flash-prevention script
  2. `history.replaceState` init (top-level code)
  3. `initApp()` hash-based navigation
- Cleared on logout (`localStorage.removeItem`) to prevent cross-account leakage

### Photos disappearing on reload (fixed 2026-02-19)
- **Cause:** `navigateTo('photos')` called `renderPhotoAlbum()` before Supabase photo data finished loading (race condition in `initApp`)
- **Fix:** After photo loading completes (line ~337), check if `_navCurrent==='photos'` and re-render the photos page
- Only affects users who reload while already on the `#photos` page

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

### Photo "..." Menu (updated 2026-02-19)
- **All photos on My Photos page** (profile, cover, post) have "..." overlay button (top-right, visible on hover)
- Options: "Add to Album" (opens album selector modal)
- Album tab photos show "Remove from Album" instead
- Album selector lists all user's albums, with "Create New Album" option
- Adding/removing photos auto-refreshes album tab content inline (no full page re-render)
- `_bindPhotoAlbumMenus()` helper binds menu buttons, re-called on album tab switch
- Old drag-and-drop onto album cards removed (album cards replaced by pill tabs)

### Upload Photos to Albums (added 2026-02-19)
- Each album tab shows an **"Upload Photos"** button above the photo grid
- Opens multi-file picker (`accept="image/*" multiple`)
- Uploads to Supabase Storage via `sbUploadPostImage`, then adds URL to album via `sbAddPhotoToAlbum`
- Shows spinner during upload, auto-refreshes album content on completion
- `_bindAlbumUpload()` helper binds upload button, re-called on tab switch and content refresh

### Layout (updated 2026-02-19)
- Albums tab appears FIRST (left) in the tabs, Photos tab second
- **My Photos page section order:** Profile Pictures → Cover Photos → Created Albums → Post Photos
- Old album card grid (horizontal scroll of cover images) removed
- **Created Albums uses pill tab system** — same `.search-tab` / `.search-tabs` classes as Skin Shop
  - Each pill = album name, click to show that album's photos below
  - Horizontal overflow scroll with drag-scroll on tab row
  - Active pill uses primary accent color
  - Small X icon on each pill for individual album deletion
  - Create + Delete All buttons in section header
- **Album photos display in 2-row horizontal scroll grid**
  - 150px photos (130px tablet, 120px mobile)
  - Drag-scroll + shift+scroll on desktop, native touch on mobile
  - Smooth fade/slide transition (0.25s) when switching album tabs
  - Empty state: "No albums created yet." / "No photos in this album."
- CSS classes added: `.album-photo-scroll`, `.album-del-x`, `#albumTabContent` transition
- JS helpers added: `_renderAlbumTabPhotos()`, `_bindAlbumPhotoScroll()`, `currentAlbumTab` state var

### Migration
- Run `supabase/add-albums.sql` in Supabase SQL Editor for existing deployments
- Full schema also updated in `supabase/schema.sql`
