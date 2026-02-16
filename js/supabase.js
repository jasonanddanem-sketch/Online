// =============================================================================
// BlipVibe — Supabase Client + Data Layer
// Drop-in replacement for fake/local data. Vanilla JS, async/await.
// =============================================================================

// ---- 1. INIT ----------------------------------------------------------------
const SUPABASE_URL  = 'https://jrybcihteqlqkdbrmagx.supabase.co';   // e.g. https://xyzcompany.supabase.co
const SUPABASE_ANON = 'sb_publishable_PPMPXSazIqUTmkgAx6f3Tg_VVyn1VbB';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ---- 2. AUTH ----------------------------------------------------------------

async function sbSignUp(email, password, username) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });
  if (error) throw error;

  // Insert profile row after signup.
  // Uses upsert so it won't conflict if the DB trigger already created it.
  // Only works when a session is returned (email confirmation disabled).
  if (data.user && data.session) {
    const { error: profileErr } = await sb.from('profiles')
      .upsert({
        id: data.user.id,
        username: username,
        display_name: username,
        bio: '',
        avatar_url: null,
        cover_photo_url: null
      }, { onConflict: 'id' });
    if (profileErr) console.error('Profile insert failed:', profileErr.message);
  }
  return data;
}

async function sbSignIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function sbSignOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

async function sbGetUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// Ensure a profile row exists for the given auth user.
// Called after email confirmation when the signup didn't create one.
async function sbEnsureProfile(authUser) {
  // Try to fetch existing profile first
  const { data: existing } = await sb.from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();
  if (existing) return existing;

  // No profile yet — create one using metadata from signup
  const username = authUser.user_metadata?.username || authUser.email.split('@')[0];
  const { data, error } = await sb.from('profiles')
    .upsert({
      id: authUser.id,
      username: username,
      display_name: username,
      bio: '',
      avatar_url: null,
      cover_photo_url: null
    }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function sbOnAuthChange(callback) {
  sb.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

// ---- 3. PROFILES ------------------------------------------------------------

async function sbGetProfile(userId) {
  const { data, error } = await sb.from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function sbGetProfileByUsername(username) {
  const { data, error } = await sb.from('profiles')
    .select('*')
    .eq('username', username)
    .single();
  if (error) throw error;
  return data;
}

async function sbUpdateProfile(userId, updates) {
  const { data, error } = await sb.from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function sbSearchProfiles(query, limit = 20) {
  const { data, error } = await sb.from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,bio.ilike.%${query}%`)
    .limit(limit);
  if (error) throw error;
  return data;
}

async function sbGetAllProfiles(limit = 50) {
  const { data, error } = await sb.from('profiles')
    .select('*')
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---- 4. POSTS ---------------------------------------------------------------

async function sbCreatePost(authorId, content, imageUrl = null, groupId = null, sharedPostId = null, location = null) {
  var row = { author_id: authorId, content: content, image_url: imageUrl, group_id: groupId };
  if (sharedPostId) row.shared_post_id = sharedPostId;
  if (location) row.location = location;
  const { data, error } = await sb.from('posts')
    .insert(row)
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)
    `)
    .single();
  if (error) throw error;
  return data;
}

async function sbGetFeed(limit = 50, offset = 0) {
  const { data, error } = await sb.from('posts')
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url),
      comments:comments(count)
    `)
    .is('group_id', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  // Fetch like counts separately (no FK between posts and likes)
  for (const post of (data || [])) {
    const { count } = await sb.from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'post')
      .eq('target_id', post.id);
    post.like_count = count || 0;
  }
  return data;
}

async function sbGetFollowingFeed(userId, limit = 50, offset = 0) {
  // Get IDs the user follows
  const { data: follows } = await sb.from('follows')
    .select('followed_id')
    .eq('follower_id', userId);
  const followedIds = (follows || []).map(f => f.followed_id);
  followedIds.push(userId); // include own posts

  if (!followedIds.length) return [];

  const { data, error } = await sb.from('posts')
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url),
      comments:comments(count)
    `)
    .is('group_id', null)
    .in('author_id', followedIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  // Fetch like counts separately (no FK between posts and likes)
  for (const post of (data || [])) {
    const { count } = await sb.from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'post')
      .eq('target_id', post.id);
    post.like_count = count || 0;
  }
  return data;
}

async function sbGetPostsByIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await sb.from('posts')
    .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
    .in('id', ids);
  if (error) throw error;
  return data || [];
}

async function sbGetUserPosts(userId, limit = 20) {
  const { data, error } = await sb.from('posts')
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url),
      comments:comments(count)
    `)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function sbDeletePost(postId) {
  const { error } = await sb.from('posts')
    .delete()
    .eq('id', postId);
  if (error) throw error;
}

// ---- 5. COMMENTS ------------------------------------------------------------

async function sbCreateComment(postId, authorId, content, parentCommentId = null) {
  const { data, error } = await sb.from('comments')
    .insert({
      post_id: postId,
      author_id: authorId,
      content,
      parent_comment_id: parentCommentId
    })
    .select(`
      *,
      author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)
    `)
    .single();
  if (error) throw error;
  return data;
}

// Lightweight comment fetch for inline preview (no per-comment like counts)
async function sbGetCommentsLite(postId, limit = 20) {
  // Try with explicit FK hint first
  let res = await sb.from('comments')
    .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(limit);
  // If FK hint fails, try without it
  if (res.error) {
    console.warn('sbGetCommentsLite FK hint failed, retrying without:', res.error.message);
    res = await sb.from('comments')
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(limit);
  }
  if (res.error) throw res.error;
  return res.data || [];
}

async function sbGetComments(postId, sortBy = 'top') {
  // Try with FK hint, fallback without
  let res = await sb.from('comments')
    .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: sortBy === 'oldest' || sortBy === 'top' });
  if (res.error) {
    res = await sb.from('comments')
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: sortBy === 'oldest' || sortBy === 'top' });
  }
  if (res.error) throw res.error;
  var data = res.data || [];

  // Fetch like counts in parallel (not N+1 sequential)
  await Promise.all(data.map(async function(c) {
    try {
      const { count } = await sb.from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('target_type', 'comment')
        .eq('target_id', c.id);
      c.like_count = count || 0;
    } catch(e) { c.like_count = 0; }
  }));
  if (sortBy === 'top') {
    data.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
  }
  return data;
}

async function sbDeleteComment(commentId) {
  const { error } = await sb.from('comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}

// ---- 6. LIKES ---------------------------------------------------------------

async function sbToggleLike(userId, targetType, targetId) {
  // Check if already liked
  const { data: existing } = await sb.from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();

  if (existing) {
    // Unlike
    const { error } = await sb.from('likes')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;
    return false; // now unliked
  } else {
    // Like
    const { error } = await sb.from('likes')
      .insert({ user_id: userId, target_type: targetType, target_id: targetId });
    if (error) throw error;
    return true; // now liked
  }
}

async function sbGetUserLikes(userId, targetType = null) {
  let query = sb.from('likes')
    .select('target_type, target_id')
    .eq('user_id', userId);
  if (targetType) query = query.eq('target_type', targetType);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function sbGetLikeCount(targetType, targetId) {
  const { count, error } = await sb.from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId);
  if (error) throw error;
  return count;
}

async function sbGetLikers(targetType, targetId, limit = 10) {
  const { data, error } = await sb.from('likes')
    .select(`
      user:profiles!likes_user_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .limit(limit);
  if (error) throw error;
  return (data || []).map(d => d.user);
}

// ---- 7. FOLLOWS -------------------------------------------------------------

async function sbFollow(followerId, followedId) {
  const { error } = await sb.from('follows')
    .insert({ follower_id: followerId, followed_id: followedId });
  if (error) throw error;
}

async function sbUnfollow(followerId, followedId) {
  const { error } = await sb.from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followed_id', followedId);
  if (error) throw error;
}

async function sbGetFriendsOfFriends(userId, limit = 30) {
  // Get who I follow
  const { data: myFollows } = await sb.from('follows')
    .select('followed_id')
    .eq('follower_id', userId);
  const myFollowedIds = (myFollows || []).map(f => f.followed_id);
  if (!myFollowedIds.length) return [];

  // Get who my follows follow
  const { data: fofFollows } = await sb.from('follows')
    .select('followed_id')
    .in('follower_id', myFollowedIds)
    .not('followed_id', 'eq', userId);
  const fofIds = [...new Set((fofFollows || []).map(f => f.followed_id))];

  // Get who follows me
  const { data: myFollowers } = await sb.from('follows')
    .select('follower_id')
    .eq('followed_id', userId);
  const myFollowerIds = (myFollowers || []).map(f => f.follower_id);

  // Exclude self, people I already follow, and my followers
  const excludeIds = new Set([userId, ...myFollowedIds, ...myFollowerIds]);
  const suggestIds = fofIds.filter(id => !excludeIds.has(id)).slice(0, limit);
  if (!suggestIds.length) return [];

  const { data, error } = await sb.from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .in('id', suggestIds);
  if (error) throw error;
  return data || [];
}

async function sbIsFollowing(followerId, followedId) {
  const { data } = await sb.from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('followed_id', followedId)
    .maybeSingle();
  return !!data;
}

async function sbGetFollowing(userId) {
  const { data, error } = await sb.from('follows')
    .select(`
      followed:profiles!follows_followed_id_fkey(id, username, display_name, avatar_url, bio)
    `)
    .eq('follower_id', userId);
  if (error) throw error;
  return (data || []).map(d => d.followed);
}

async function sbGetFollowers(userId) {
  const { data, error } = await sb.from('follows')
    .select(`
      follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)
    `)
    .eq('followed_id', userId);
  if (error) throw error;
  return (data || []).map(d => d.follower);
}

async function sbGetFollowCounts(userId) {
  const [{ count: following }, { count: followers }] = await Promise.all([
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', userId)
  ]);
  return { following: following || 0, followers: followers || 0 };
}

// ---- 8. NOTIFICATIONS -------------------------------------------------------

async function sbGetNotifications(userId, limit = 50) {
  const { data, error } = await sb.from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function sbMarkNotificationsRead(userId) {
  const { error } = await sb.from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

async function sbGetUnreadCount(userId) {
  const { count, error } = await sb.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count || 0;
}

async function sbCreateNotification(userId, type, title, body, data) {
  // Map app-internal types to the DB enum: comment, reply, like, follow, purchase, system
  const typeMap = { group: 'system', skin: 'purchase', coin: 'purchase', message: 'system' };
  const dbType = typeMap[type] || ((['comment','reply','like','follow','purchase','system'].indexOf(type) !== -1) ? type : 'system');
  const { error } = await sb.from('notifications')
    .insert({ user_id: userId, type: dbType, title: title || '', body: body || '', data: data || {} });
  if (error) throw error;
}

// ---- 9. COINS ---------------------------------------------------------------

async function sbGetCoinBalance(userId) {
  const { data } = await sb.from('profiles')
    .select('coin_balance')
    .eq('id', userId)
    .single();
  return data?.coin_balance || 0;
}

async function sbGetCoinTransactions(userId, limit = 50) {
  const { data, error } = await sb.from('coin_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---- 10. STORAGE (avatars / post images) ------------------------------------

async function sbUploadFile(bucket, path, file) {
  const { data, error } = await sb.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
  // Append cache-buster so browser doesn't serve stale cached image
  return urlData.publicUrl + '?t=' + Date.now();
}

async function sbUploadAvatar(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  return sbUploadFile('avatars', path, file);
}

async function sbUploadCover(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/cover-${Date.now()}.${ext}`;
  return sbUploadFile('avatars', path, file);
}

async function sbListUserAvatars(userId) {
  const { data, error } = await sb.storage
    .from('avatars')
    .list(userId, { sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw error;
  return (data || [])
    .filter(f => f.name.startsWith('avatar'))
    .map(f => {
      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(userId + '/' + f.name);
      return { src: urlData.publicUrl + '?t=' + Date.now(), date: new Date(f.created_at).getTime(), name: f.name };
    });
}

async function sbListUserCovers(userId) {
  const { data, error } = await sb.storage
    .from('avatars')
    .list(userId, { sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw error;
  return (data || [])
    .filter(f => f.name.startsWith('cover'))
    .map(f => {
      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(userId + '/' + f.name);
      return { src: urlData.publicUrl + '?t=' + Date.now(), date: new Date(f.created_at).getTime(), name: f.name };
    });
}

async function sbUploadPostImage(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;
  return sbUploadFile('posts', path, file);
}

// ---- 11. GROUPS -------------------------------------------------------------

async function sbGetGroups(limit = 50) {
  const { data, error } = await sb.from('groups')
    .select(`
      *,
      owner:profiles!groups_owner_id_fkey(id, username, display_name, avatar_url),
      member_count:group_members(count)
    `)
    .limit(limit);
  if (error) throw error;
  return data;
}

async function sbGetGroupMembers(groupId) {
  const { data, error } = await sb.from('group_members')
    .select(`
      *,
      user:profiles!group_members_user_id_fkey(id, username, display_name, avatar_url, bio)
    `)
    .eq('group_id', groupId);
  if (error) throw error;
  return data;
}

async function sbJoinGroup(groupId, userId) {
  const { error } = await sb.from('group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' });
  if (error) throw error;
}

async function sbCreateGroup(ownerId, name, description) {
  const { data, error } = await sb.from('groups')
    .insert({ owner_id: ownerId, name, description: description || '' })
    .select(`
      *,
      owner:profiles!groups_owner_id_fkey(id, username, display_name, avatar_url),
      member_count:group_members(count)
    `)
    .single();
  if (error) throw error;
  // Auto-add owner as member
  await sb.from('group_members')
    .insert({ group_id: data.id, user_id: ownerId, role: 'owner' });
  return data;
}

async function sbDeleteGroup(groupId) {
  const { error } = await sb.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

async function sbLeaveGroup(groupId, userId) {
  const { error } = await sb.from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ---- 12. SKINS --------------------------------------------------------------

async function sbGetSkins() {
  const { data, error } = await sb.from('skins')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return data;
}

async function sbGetUserSkins(userId) {
  const { data, error } = await sb.from('user_skins')
    .select('*, skin:skins(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

// ---- 13. REALTIME HELPERS ---------------------------------------------------

function sbSubscribePosts(callback) {
  return sb.channel('public:posts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
      callback(payload.new);
    })
    .subscribe();
}

function sbSubscribeNotifications(userId, callback) {
  return sb.channel('notifications:' + userId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, payload => {
      callback(payload.new);
    })
    .subscribe();
}

// ---- 14. MESSAGES -----------------------------------------------------------

async function sbGetConversations(userId) {
  // Get all messages where user is sender or receiver, grouped by the other person
  const { data, error } = await sb.from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url),
      receiver:profiles!messages_receiver_id_fkey(id, username, display_name, avatar_url)
    `)
    .or('sender_id.eq.' + userId + ',receiver_id.eq.' + userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Group by conversation partner
  var convos = {};
  (data || []).forEach(function(m) {
    var partnerId = m.sender_id === userId ? m.receiver_id : m.sender_id;
    if (!convos[partnerId]) {
      var partner = m.sender_id === userId ? m.receiver : m.sender;
      convos[partnerId] = {
        partnerId: partnerId,
        partner: partner,
        lastMessage: m,
        unread: 0
      };
    }
    if (m.receiver_id === userId && !m.is_read) convos[partnerId].unread++;
  });
  // Sort by most recent message
  return Object.values(convos).sort(function(a, b) {
    return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
  });
}

async function sbGetMessages(userId, partnerId, limit = 100) {
  const { data, error } = await sb.from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url)
    `)
    .or(
      'and(sender_id.eq.' + userId + ',receiver_id.eq.' + partnerId + '),' +
      'and(sender_id.eq.' + partnerId + ',receiver_id.eq.' + userId + ')'
    )
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function sbSendMessage(senderId, receiverId, content) {
  const { data, error } = await sb.from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content: content })
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url)
    `)
    .single();
  if (error) throw error;
  return data;
}

async function sbMarkMessagesRead(userId, partnerId) {
  const { error } = await sb.from('messages')
    .update({ is_read: true })
    .eq('receiver_id', userId)
    .eq('sender_id', partnerId)
    .eq('is_read', false);
  if (error) throw error;
}

function sbSubscribeMessages(userId, callback) {
  return sb.channel('messages:' + userId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: 'receiver_id=eq.' + userId
    }, payload => {
      callback(payload.new);
    })
    .subscribe();
}

// ---- 15. UTILITY: timeAgo for real timestamps --------------------------------

function timeAgoReal(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hr' + (Math.floor(diff / 3600) > 1 ? 's' : '') + ' ago';
  if (diff < 604800) return Math.floor(diff / 86400) + ' day' + (Math.floor(diff / 86400) > 1 ? 's' : '') + ' ago';
  return new Date(dateStr).toLocaleDateString();
}

// ---- EXPORT (globals for vanilla JS) ----------------------------------------
// All sb* functions are already global. This file must be loaded BEFORE app.js.
