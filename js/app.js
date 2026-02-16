document.addEventListener('DOMContentLoaded', function () {

// ======================== AUTHENTICATION (Supabase) ========================
// currentUser holds the live profile row; currentAuthUser holds auth.users row
var currentUser = null;    // { id, username, display_name, bio, avatar_url, ... }
var currentAuthUser = null;

var loginPage = document.getElementById('loginPage');
var appShell = document.getElementById('appShell');
var loginForm = document.getElementById('loginForm');
var loginError = document.getElementById('loginError');
var loginEmail = document.getElementById('loginEmail');
var loginPass = document.getElementById('loginPassword');
var signupForm = document.getElementById('signupForm');
var signupError = document.getElementById('signupError');

function showApp() {
    loginPage.classList.remove('visible');
    loginPage.classList.add('hidden');
    appShell.classList.add('active');
}
function showLogin() {
    appShell.classList.remove('active');
    loginPage.classList.remove('hidden');
    loginPage.classList.add('visible');
}

// Toggle password visibility
document.getElementById('togglePassword').addEventListener('click', function () {
    var inp = loginPass;
    var icon = this.querySelector('i');
    if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash'; }
    else { inp.type = 'password'; icon.className = 'fas fa-eye'; }
});

// Login form submit
loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    loginError.classList.remove('show');
    var submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    var email = loginEmail.value.trim();
    var pw = loginPass.value;
    if (!email || !pw) { loginError.textContent = 'Please enter both email and password.'; loginError.classList.add('show'); return; }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    try {
        await sbSignIn(email, pw);
        loginForm.reset();
        // onAuthStateChange will call initApp()
    } catch (err) {
        loginError.textContent = err.message || 'Invalid email or password.';
        loginError.classList.add('show');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Sign In <i class="fas fa-arrow-right"></i>';
    }
});

// Signup form submit
signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    signupError.classList.remove('show');
    var submitBtn = signupForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    var username = document.getElementById('signupUsername').value.trim();
    var email = document.getElementById('signupEmail').value.trim();
    var pw = document.getElementById('signupPassword').value;
    if (!username || !email || !pw) { signupError.textContent = 'All fields are required.'; signupError.classList.add('show'); return; }
    if (pw.length < 6) { signupError.textContent = 'Password must be at least 6 characters.'; signupError.classList.add('show'); return; }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    try {
        var result = await sbSignUp(email, pw, username);
        // If email confirmation is disabled, Supabase returns a session directly.
        // If enabled, session is null — user must confirm email first.
        if (result.session) {
            // Session exists: auto-signed-in, onAuthStateChange will fire
            signupForm.reset();
        } else {
            // No session: email confirmation required
            signupError.textContent = 'Check your email to confirm your account, then sign in.';
            signupError.classList.add('show');
            signupError.style.color = '#22c55e';
            signupForm.reset();
        }
    } catch (err) {
        signupError.textContent = err.message || 'Signup failed.';
        signupError.style.color = '';
        signupError.classList.add('show');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Account <i class="fas fa-arrow-right"></i>';
    }
});

// Toggle between login and signup forms
document.querySelector('.login-create').addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    document.querySelector('.login-divider').style.display = 'none';
    document.querySelector('.login-footer').style.display = 'none';
    document.querySelector('.login-title').textContent = 'Create an account';
    document.querySelector('.login-subtitle').textContent = 'Join BlipVibe today';
    signupForm.style.display = '';
    document.getElementById('signupFooter').style.display = '';
});
document.querySelector('.login-back') && document.querySelector('.login-back').addEventListener('click', function (e) {
    e.preventDefault();
    signupForm.style.display = 'none';
    document.getElementById('signupFooter').style.display = 'none';
    document.querySelector('.login-title').textContent = 'Welcome back';
    document.querySelector('.login-subtitle').textContent = 'Sign in to your account';
    loginForm.style.display = '';
    document.querySelector('.login-divider').style.display = '';
    document.querySelector('.login-footer').style.display = '';
});

// Forgot password
document.querySelector('.login-forgot').addEventListener('click', async function (e) {
    e.preventDefault();
    var email = loginEmail.value.trim();
    if (!email) { loginError.textContent = 'Enter your email first, then click Forgot password.'; loginError.classList.add('show'); return; }
    try {
        await sb.auth.resetPasswordForEmail(email);
        loginError.textContent = 'Password reset email sent! Check your inbox.';
        loginError.classList.add('show');
        loginError.style.color = 'var(--primary)';
    } catch (err) {
        loginError.textContent = err.message;
        loginError.classList.add('show');
    }
});

// Logout handler (wired later after DOM references are set)
function handleLogout() {
    sbSignOut().then(function () {
        currentUser = null;
        currentAuthUser = null;
        showLogin();
    });
}

var DEFAULT_AVATAR = 'images/default-avatar.svg';

// Helper: get avatar URL for current user (returns placeholder if none)
function getMyAvatarUrl() {
    return (currentUser && currentUser.avatar_url) || DEFAULT_AVATAR;
}

// Helper: get avatar URL for any person/profile object
function getAvatarFor(p) {
    return (p && p.avatar_url) || DEFAULT_AVATAR;
}

// Helper: populate header UI from currentUser profile
function populateUserUI() {
    if (!currentUser) return;
    var name = currentUser.display_name || currentUser.username;
    var avatar = getMyAvatarUrl();
    // Nav bar
    var navAvatar = document.querySelector('.nav-avatar');
    if (navAvatar) navAvatar.src = avatar;
    var navUsername = document.querySelector('.nav-username');
    if (navUsername) navUsername.textContent = name;
    // Profile card sidebar
    var profAvatar = document.getElementById('profileAvatarImg');
    if (profAvatar) profAvatar.src = avatar;
    var profName = document.querySelector('.profile-name');
    if (profName) profName.textContent = name;
    var profTitle = document.querySelector('.profile-title');
    if (profTitle) profTitle.textContent = currentUser.status || '';
    var profAbout = document.querySelector('.profile-about');
    if (profAbout) profAbout.textContent = currentUser.bio || '';
    // Post create bar avatar
    var postAvatar = document.querySelector('.post-create-avatar');
    if (postAvatar) postAvatar.src = avatar;
    // Coins
    var coinEl = document.getElementById('navCoinCount');
    if (coinEl) coinEl.textContent = currentUser.coin_balance || 0;
}

// Sync all avatar images on the page when avatar changes
function syncAllAvatars(newSrc) {
    var old = getMyAvatarUrl();
    var oldBase = old ? old.split('?')[0] : '';
    if (currentUser) currentUser.avatar_url = newSrc;
    document.querySelectorAll('img').forEach(function (img) {
        if (img.src === old || (oldBase && img.src.split('?')[0] === oldBase)) img.src = newSrc;
    });
    populateUserUI();
}

// ---- Init app after auth ----
var _initAppRunning = false;
async function initApp() {
    if (_initAppRunning) return;
    _initAppRunning = true;
    var authUser = await sbGetUser();
    if (!authUser) { _initAppRunning = false; showLogin(); return; }
    currentAuthUser = authUser;
    try {
        currentUser = await sbGetProfile(authUser.id);
    } catch (e) {
        // Profile doesn't exist yet (e.g. email confirmation flow) — create it now
        try {
            currentUser = await sbEnsureProfile(authUser);
        } catch (e2) {
            console.error('Failed to create profile:', e2);
            showLogin(); return;
        }
    }
    state.coins = currentUser.coin_balance || 0;
    loadState(); // Restore skins, settings, purchases from localStorage
    // If localStorage had no data, try loading from Supabase (cross-browser sync)
    var localKey='blipvibe_'+currentUser.id;
    if(!localStorage.getItem(localKey)){
        await loadSkinDataFromSupabase();
    }
    populateUserUI();
    showApp();
    reapplyCustomizations(); // Re-apply skins, fonts, nav styles, dark mode
    if(currentUser.cover_photo_url) { state.coverPhoto = currentUser.cover_photo_url; applyCoverPhoto(); }
    // Load user's existing likes from Supabase so UI reflects correct state
    try {
        var myLikes = await sbGetUserLikes(currentUser.id, 'post');
        myLikes.forEach(function(l){ state.likedPosts[l.target_id] = true; });
    } catch(e){ console.warn('Could not load user likes:', e); }
    // Load photos from Supabase storage and posts
    try {
        var prevAvatars = await sbListUserAvatars(currentUser.id);
        state.photos.profile = prevAvatars.map(function(a){ return { src: a.src, date: a.date }; });
    } catch(e){ console.warn('Could not load avatar history:', e); }
    try {
        var prevCovers = await sbListUserCovers(currentUser.id);
        state.photos.cover = prevCovers.map(function(c){ return { src: c.src, date: c.date }; });
    } catch(e){ console.warn('Could not load cover history:', e); }
    try {
        var myPosts = await sbGetUserPosts(currentUser.id, 50);
        state.photos.post = (myPosts||[]).filter(function(p){ return p.image_url; }).map(function(p){ return { src: p.image_url, date: new Date(p.created_at).getTime() }; });
    } catch(e){ console.warn('Could not load post photos:', e); }
    renderPhotosCard();
    await loadFollowCounts();
    await loadGroups();
    // Load joined groups from group_members table
    try {
        var allGroups = groups || [];
        for(var gi=0;gi<allGroups.length;gi++){
            var members = await sbGetGroupMembers(allGroups[gi].id);
            if(members && members.some(function(m){ return m.user_id === currentUser.id; })){
                state.joinedGroups[allGroups[gi].id] = true;
            }
        }
    } catch(e){ console.warn('Could not load group memberships:', e); }
    renderGroups();
    renderTrendingSidebar();
    await generatePosts();
    renderSuggestions();
    // Load notifications from Supabase
    try {
        var notifs = await sbGetNotifications(currentUser.id);
        state.notifications = (notifs||[]).map(function(n){
            return { type: n.type||'system', text: n.title||n.body||'', time: timeAgoReal(n.created_at), read: n.is_read, id: n.id };
        });
        updateNotifBadge();
        renderNotifications();
    } catch(e){ console.warn('Could not load notifications:', e); }
    // Subscribe to realtime notifications
    try {
        sbSubscribeNotifications(currentUser.id, function(newNotif){
            state.notifications.unshift({ type: newNotif.type||'system', text: newNotif.title||newNotif.body||'', time: 'just now', read: false, id: newNotif.id });
            updateNotifBadge();
            renderNotifications();
        });
    } catch(e){ console.warn('Realtime notifications error:', e); }
    // Load conversations and subscribe to realtime messages
    loadConversations();
    initMessageSubscription();
    _initAppRunning = false;
}

// Listen for auth state changes
sbOnAuthChange(function (session) {
    if (session) {
        initApp();
    } else {
        showLogin();
    }
});

// Load real stats for the login page hero section
(async function loadLoginStats() {
    try {
        var [users, posts, groups] = await Promise.all([
            sb.from('profiles').select('*', { count: 'exact', head: true }),
            sb.from('posts').select('*', { count: 'exact', head: true }),
            sb.from('groups').select('*', { count: 'exact', head: true })
        ]);
        var fmt = function(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K+' : String(n); };
        var el;
        el = document.getElementById('statUsers'); if (el) el.textContent = fmt(users.count || 0);
        el = document.getElementById('statPosts'); if (el) el.textContent = fmt(posts.count || 0);
        el = document.getElementById('statGroups'); if (el) el.textContent = fmt(groups.count || 0);
    } catch (e) { /* stats are non-critical */ }
})();

// Check session on load
(async function () {
    var user = await sbGetUser();
    if (user) {
        await initApp();
    } else {
        showLogin();
    }
})();

// ======================== STATE ========================
var myFollowers=[];
var state = {
    coins: 0,
    following: 0,
    followers: 0,
    followedUsers: {},
    ownedSkins: {},
    activeSkin: null,
    ownedFonts: {},
    activeFont: null,
    ownedLogos: {},
    activeLogo: null,
    notifications: [],
    joinedGroups: {},
    messages: {},
    likedPosts: {},
    coverPhoto: null,
    comments: {},
    ownedIconSets: {},
    activeIconSet: null,
    ownedCoinSkins: {},
    activeCoinSkin: null,
    ownedTemplates: {},
    activeTemplate: null,
    ownedNavStyles: {},
    activeNavStyle: null,
    ownedPremiumSkins: {},
    activePremiumSkin: null,
    groupPosts: {},
    privateFollowers: false,
    dislikedPosts: {},
    photos:{profile:[],cover:[],post:[],albums:[]},
    postCoinCount: 0,
    commentCoinPosts: {},
    replyCoinPosts: {},
    groupCoins: {},
    groupOwnedSkins: {},
    groupOwnedPremiumSkins: {},
    groupActiveSkin: {},
    groupActivePremiumSkin: {},
    groupPostCoinCount: {},
    groupCommentCoinPosts: {},
    groupReplyCoinPosts: {}
};
var settings={darkMode:false,notifSound:true,privateProfile:false,autoplay:true,commentOrder:'top'};

// Persist state to localStorage (keyed per user)
function saveState(){
    if(!currentUser) return;
    var key='blipvibe_'+currentUser.id;
    // When viewing another profile/group, skin values are temporarily overridden.
    // Always save the user's own values (from _pvSaved/_gvSaved backup if active).
    var _bk=_pvSaved||_gvSaved||null;
    var save={
        ownedSkins:state.ownedSkins,activeSkin:_bk?_bk.skin:state.activeSkin,
        ownedFonts:state.ownedFonts,activeFont:_bk&&_bk.font!==undefined?_bk.font:state.activeFont,
        ownedLogos:state.ownedLogos,activeLogo:state.activeLogo,
        ownedIconSets:state.ownedIconSets,activeIconSet:state.activeIconSet,
        ownedCoinSkins:state.ownedCoinSkins,activeCoinSkin:state.activeCoinSkin,
        ownedTemplates:state.ownedTemplates,activeTemplate:_bk&&_bk.tpl!==undefined?_bk.tpl:state.activeTemplate,
        ownedNavStyles:state.ownedNavStyles,activeNavStyle:state.activeNavStyle,
        ownedPremiumSkins:state.ownedPremiumSkins,activePremiumSkin:_bk?_bk.premiumSkin:state.activePremiumSkin,
        joinedGroups:state.joinedGroups,privateFollowers:state.privateFollowers,
        groupCoins:state.groupCoins,groupOwnedSkins:state.groupOwnedSkins,
        groupOwnedPremiumSkins:state.groupOwnedPremiumSkins,
        groupActiveSkin:state.groupActiveSkin,groupActivePremiumSkin:state.groupActivePremiumSkin,
        premiumBgUrl:_bk?_bk.bgImage:premiumBgImage,
        premiumBgSaturation:_bk?_bk.bgSat:premiumBgSaturation,
        settings:settings
    };
    try{localStorage.setItem(key,JSON.stringify(save));}catch(e){console.warn('localStorage save failed (quota?):', e.message);}
    // Sync skin data to Supabase for cross-browser and profile viewing
    syncSkinDataToSupabase();
}
var _skinSyncTimer=null;
function syncSkinDataToSupabase(){
    if(!currentUser) return;
    // Debounce — only sync after 2s of no changes (saveState runs every 10s too)
    clearTimeout(_skinSyncTimer);
    _skinSyncTimer=setTimeout(function(){
        var _bk=_pvSaved||_gvSaved||null;
        var skinData={
            activeSkin:(_bk?_bk.skin:state.activeSkin)||null,
            activePremiumSkin:(_bk?_bk.premiumSkin:state.activePremiumSkin)||null,
            activeFont:(_bk&&_bk.font!==undefined?_bk.font:state.activeFont)||null,
            activeTemplate:(_bk&&_bk.tpl!==undefined?_bk.tpl:state.activeTemplate)||null,
            activeNavStyle:state.activeNavStyle||null,
            activeIconSet:state.activeIconSet||null,
            activeLogo:state.activeLogo||null,
            activeCoinSkin:state.activeCoinSkin||null,
            premiumBgUrl:(_bk?_bk.bgImage:premiumBgImage)||null,
            premiumBgSaturation:(_bk?_bk.bgSat:premiumBgSaturation)||100,
            ownedSkins:state.ownedSkins||{},
            ownedPremiumSkins:state.ownedPremiumSkins||{},
            ownedFonts:state.ownedFonts||{},
            ownedTemplates:state.ownedTemplates||{},
            ownedNavStyles:state.ownedNavStyles||{},
            ownedIconSets:state.ownedIconSets||{},
            ownedLogos:state.ownedLogos||{},
            ownedCoinSkins:state.ownedCoinSkins||{}
        };
        sbUpdateProfile(currentUser.id,{skin_data:skinData}).catch(function(e){
            console.warn('Skin data sync error:',e);
        });
    },2000);
}
async function loadSkinDataFromSupabase(){
    if(!currentUser) return;
    try{
        var profile=await sbGetProfile(currentUser.id);
        if(!profile||!profile.skin_data) return;
        var sd=profile.skin_data;
        if(sd.activeSkin) state.activeSkin=sd.activeSkin;
        if(sd.activePremiumSkin) state.activePremiumSkin=sd.activePremiumSkin;
        if(sd.activeFont) state.activeFont=sd.activeFont;
        if(sd.activeTemplate) state.activeTemplate=sd.activeTemplate;
        if(sd.activeNavStyle) state.activeNavStyle=sd.activeNavStyle;
        if(sd.activeIconSet) state.activeIconSet=sd.activeIconSet;
        if(sd.activeLogo) state.activeLogo=sd.activeLogo;
        if(sd.activeCoinSkin) state.activeCoinSkin=sd.activeCoinSkin;
        if(sd.premiumBgUrl) premiumBgImage=sd.premiumBgUrl;
        if(sd.premiumBgSaturation!==undefined) premiumBgSaturation=sd.premiumBgSaturation;
        if(sd.ownedSkins) Object.assign(state.ownedSkins,sd.ownedSkins);
        if(sd.ownedPremiumSkins) Object.assign(state.ownedPremiumSkins,sd.ownedPremiumSkins);
        if(sd.ownedFonts) Object.assign(state.ownedFonts,sd.ownedFonts);
        if(sd.ownedTemplates) Object.assign(state.ownedTemplates,sd.ownedTemplates);
        if(sd.ownedNavStyles) Object.assign(state.ownedNavStyles,sd.ownedNavStyles);
        if(sd.ownedIconSets) Object.assign(state.ownedIconSets,sd.ownedIconSets);
        if(sd.ownedLogos) Object.assign(state.ownedLogos,sd.ownedLogos);
        if(sd.ownedCoinSkins) Object.assign(state.ownedCoinSkins,sd.ownedCoinSkins);
    }catch(e){console.warn('Load skin data from Supabase:',e);}
}
function loadState(){
    if(!currentUser) return;
    var key='blipvibe_'+currentUser.id;
    try{
        var raw=localStorage.getItem(key);
        if(!raw) return;
        var save=JSON.parse(raw);
        // Restore owned items and active customizations
        if(save.ownedSkins) state.ownedSkins=save.ownedSkins;
        if(save.activeSkin) state.activeSkin=save.activeSkin;
        if(save.ownedFonts) state.ownedFonts=save.ownedFonts;
        if(save.activeFont) state.activeFont=save.activeFont;
        if(save.ownedLogos) state.ownedLogos=save.ownedLogos;
        if(save.activeLogo) state.activeLogo=save.activeLogo;
        if(save.ownedIconSets) state.ownedIconSets=save.ownedIconSets;
        if(save.activeIconSet) state.activeIconSet=save.activeIconSet;
        if(save.ownedCoinSkins) state.ownedCoinSkins=save.ownedCoinSkins;
        if(save.activeCoinSkin) state.activeCoinSkin=save.activeCoinSkin;
        if(save.ownedTemplates) state.ownedTemplates=save.ownedTemplates;
        if(save.activeTemplate) state.activeTemplate=save.activeTemplate;
        if(save.ownedNavStyles) state.ownedNavStyles=save.ownedNavStyles;
        if(save.activeNavStyle) state.activeNavStyle=save.activeNavStyle;
        if(save.ownedPremiumSkins) state.ownedPremiumSkins=save.ownedPremiumSkins;
        if(save.activePremiumSkin) state.activePremiumSkin=save.activePremiumSkin;
        if(save.joinedGroups) state.joinedGroups=save.joinedGroups;
        if(save.privateFollowers!==undefined) state.privateFollowers=save.privateFollowers;
        if(save.groupCoins) state.groupCoins=save.groupCoins;
        if(save.groupOwnedSkins) state.groupOwnedSkins=save.groupOwnedSkins;
        if(save.groupOwnedPremiumSkins) state.groupOwnedPremiumSkins=save.groupOwnedPremiumSkins;
        if(save.groupActiveSkin) state.groupActiveSkin=save.groupActiveSkin;
        if(save.groupActivePremiumSkin) state.groupActivePremiumSkin=save.groupActivePremiumSkin;
        if(save.premiumBgUrl) premiumBgImage=save.premiumBgUrl;
        if(save.premiumBgSaturation!==undefined) premiumBgSaturation=save.premiumBgSaturation;
        if(save.settings){
            settings.darkMode=!!save.settings.darkMode;
            settings.notifSound=save.settings.notifSound!==false;
            settings.privateProfile=!!save.settings.privateProfile;
            settings.autoplay=save.settings.autoplay!==false;
            settings.commentOrder=save.settings.commentOrder||'top';
        }
    }catch(e){console.warn('loadState:',e);}
}
function reapplyCustomizations(){
    if(state.activePremiumSkin) applyPremiumSkin(state.activePremiumSkin,true);
    else if(state.activeSkin) applySkin(state.activeSkin,true);
    if(state.activeFont) applyFont(state.activeFont,true);
    if(state.activeLogo) applyLogo(state.activeLogo);
    if(state.activeIconSet) applyIconSet(state.activeIconSet);
    if(state.activeCoinSkin) applyCoinSkin(state.activeCoinSkin);
    if(state.activeTemplate) applyTemplate(state.activeTemplate,true);
    if(state.activeNavStyle) applyNavStyle(state.activeNavStyle);
    if(premiumBgImage&&state.activePremiumSkin) updatePremiumBg();
    if(settings.darkMode){document.body.style.background='#1a1a2e';document.body.style.color='#eee';}
}
// Auto-save state on page leave and periodically
window.addEventListener('beforeunload',function(){saveState();});
setInterval(function(){saveState();},10000); // save every 10s as safety net

// Load follow counts from Supabase
async function loadFollowCounts() {
    if (!currentUser) return;
    try {
        var counts = await sbGetFollowCounts(currentUser.id);
        state.following = counts.following;
        state.followers = counts.followers;
        updateFollowCounts();
        // Build followedUsers map
        var following = await sbGetFollowing(currentUser.id);
        state.followedUsers = {};
        following.forEach(function (p) { state.followedUsers[p.id] = true; });
    } catch (e) { console.error('loadFollowCounts:', e); }
}

function getMyAvatar(){return getMyAvatarUrl();}
// syncAllAvatars is now defined in the auth section above

// ======================== SAVED / HIDDEN / REPORTS (in-memory, persisted to Supabase later) ========================
// These stay in-memory for now — can be moved to a Supabase table later.
var savedFolders=[{id:'fav',name:'Favorites',posts:[]}];
var hiddenPosts={};
var reportedPosts=[];
function persistSaved(){}
function persistHidden(){}
function persistReports(){}
var blockedUsers={};
function persistBlocked(){}
function findPostFolder(pid){var s=String(pid);for(var i=0;i<savedFolders.length;i++){if(savedFolders[i].posts.indexOf(s)!==-1)return savedFolders[i];}return null;}

// ======================== DATA ========================
// All user/group/message data is loaded from Supabase. No fake data.
var groups = []; // Loaded from Supabase

var badgeTypes = [
    {text:'Trending',icon:'fa-fire',cls:'badge-red'},{text:'Creator',icon:'fa-camera',cls:'badge-purple'},
    {text:'Popular',icon:'fa-star',cls:'badge-orange'},{text:'Active',icon:'fa-bolt',cls:'badge-green'},
    {text:'New',icon:'fa-sparkles',cls:'badge-blue'}
];
var locations = ['New York','LA','Chicago','London','Tokyo','Paris','Berlin','Toronto','Sydney','Miami',
    'Seattle','Austin','Denver','Portland','Boston','SF','Dublin','Amsterdam','Seoul','Mumbai'];

// Load groups from Supabase
async function loadGroups() {
    try {
        var raw = await sbGetGroups();
        groups = raw.map(function(g){
            return {
                id: g.id,
                name: g.name,
                desc: g.description || '',
                icon: g.icon || 'fa-users',
                color: g.color || '#5cbdb9',
                members: (g.member_count && g.member_count[0]) ? g.member_count[0].count : 0,
                owner_id: g.owner_id,
                owner: g.owner,
                createdBy: (currentUser && g.owner_id === currentUser.id) ? 'me' : g.owner_id,
                description: g.description || '',
                member_count: g.member_count,
                mods: [],
                coverPhoto: g.cover_photo_url || null,
                profileImg: g.avatar_url || null
            };
        });
    } catch(e) { console.error('loadGroups:', e); groups = []; }
}

function getMyGroupRole(group){ return currentUser && group.owner && group.owner.id === currentUser.id ? 'Admin' : (state.joinedGroups[group.id] ? 'Member' : null); }
function getPersonGroupRole(){ return 'Member'; }
function roleRank(role){ return role==='Admin'?4:role==='Co-Admin'?3:role==='Moderator'?2:1; }

var skins = [
    {id:'classic',name:'Classic',desc:'Clean teal and white. The original BlipVibe look.',price:1,preview:'linear-gradient(135deg,#5cbdb9,#4aada9)',cardBg:'#fff',cardText:'#333',cardMuted:'#777'},
    {id:'midnight',name:'Midnight Dark',desc:'Dark mode profile with neon accents. Sleek and mysterious vibes.',price:1,preview:'linear-gradient(135deg,#1a1a2e,#16213e)',cardBg:'#2a2a4a',cardText:'#eee',cardMuted:'#bbb'},
    {id:'ocean',name:'Ocean Blue',desc:'Cool ocean vibes for your profile. Calm and refreshing.',price:1,preview:'linear-gradient(135deg,#1976d2,#0d47a1)',cardBg:'#e3f2fd',cardText:'#1565c0',cardMuted:'#1976d2'},
    {id:'forest',name:'Forest Green',desc:'Nature-inspired earthy tones. Peaceful and grounded.',price:1,preview:'linear-gradient(135deg,#2e7d32,#1b5e20)',cardBg:'#e8f5e9',cardText:'#2e7d32',cardMuted:'#388e3c'},
    {id:'royal',name:'Royal Purple',desc:'Elegant purple royalty vibes. Stand out from the crowd.',price:1,preview:'linear-gradient(135deg,#7b1fa2,#4a148c)',cardBg:'#f3e5f5',cardText:'#6a1b9a',cardMuted:'#7b1fa2'},
    {id:'sunset',name:'Sunset Gold',desc:'Warm golden hour aesthetic. Radiate warmth and energy.',price:1,preview:'linear-gradient(135deg,#ef6c00,#e65100)',cardBg:'#fff8e1',cardText:'#e65100',cardMuted:'#ef6c00'},
    {id:'cherry',name:'Cherry Blossom',desc:'Soft pink sakura vibes. Delicate and romantic.',price:1,preview:'linear-gradient(135deg,#d81b60,#c2185b)',cardBg:'#fce4ec',cardText:'#c2185b',cardMuted:'#d81b60'},
    {id:'slate',name:'Slate Storm',desc:'Cool dark gray sophistication. Sleek and modern.',price:1,preview:'linear-gradient(135deg,#37474f,#263238)',cardBg:'#37474f',cardText:'#eceff1',cardMuted:'#90a4ae'},
    {id:'ember',name:'Ember Glow',desc:'Warm smoldering red-orange. Bold and fiery.',price:1,preview:'linear-gradient(135deg,#e64a19,#bf360c)',cardBg:'#fbe9e7',cardText:'#bf360c',cardMuted:'#e64a19'},
    {id:'arctic',name:'Arctic Frost',desc:'Icy cyan chill. Clean and refreshing.',price:1,preview:'linear-gradient(135deg,#00acc1,#00838f)',cardBg:'#e0f7fa',cardText:'#00838f',cardMuted:'#00acc1'},
    {id:'moss',name:'Moss Garden',desc:'Olive earth tones. Calm and grounded.',price:1,preview:'linear-gradient(135deg,#689f38,#558b2f)',cardBg:'#f1f8e9',cardText:'#558b2f',cardMuted:'#689f38'}
];

var fonts = [
    {id:'orbitron',name:'Orbitron',desc:'Futuristic sci-fi vibes.',price:1,family:'Orbitron',scale:.92},
    {id:'rajdhani',name:'Rajdhani',desc:'Clean tech aesthetic.',price:1,family:'Rajdhani'},
    {id:'quicksand',name:'Quicksand',desc:'Soft and rounded.',price:1,family:'Quicksand'},
    {id:'pacifico',name:'Pacifico',desc:'Fun handwritten script.',price:1,family:'Pacifico',scale:.85},
    {id:'baloo',name:'Baloo 2',desc:'Bubbly and adorable.',price:1,family:'Baloo 2'},
    {id:'playfair',name:'Playfair Display',desc:'Elegant serif style.',price:1,family:'Playfair Display'},
    {id:'spacegrotesk',name:'Space Grotesk',desc:'Modern geometric sans.',price:1,family:'Space Grotesk'},
    {id:'caveat',name:'Caveat',desc:'Casual handwriting feel.',price:1,family:'Caveat',scale:.9},
    {id:'archivo',name:'Archivo',desc:'Sharp and editorial.',price:1,family:'Archivo'},
    {id:'silkscreen',name:'Silkscreen',desc:'Retro pixel vibes.',price:1,family:'Silkscreen',scale:.78},
    {id:'pressstart',name:'Press Start 2P',desc:'Arcade pixel font.',price:1,family:'Press Start 2P',scale:.55},
    {id:'righteous',name:'Righteous',desc:'Bold retro display.',price:1,family:'Righteous',scale:.9},
    {id:'satisfy',name:'Satisfy',desc:'Smooth cursive flow.',price:1,family:'Satisfy',scale:.88},
    {id:'bungee',name:'Bungee',desc:'Chunky display type.',price:1,family:'Bungee',scale:.72},
    {id:'monoton',name:'Monoton',desc:'Neon outline glow.',price:1,family:'Monoton',scale:.68}
];

var logos = [
    {id:'bv',name:'BV',desc:'Minimal and edgy.',price:1,text:'BV'},
    {id:'electric',name:'Electric',desc:'High energy vibes.',price:1,text:'\u26A1BlipVibe'},
    {id:'sparkle',name:'Sparkle',desc:'Fancy and elegant.',price:1,text:'\u2726BlipVibe\u2726'},
    {id:'floral',name:'Floral',desc:'Soft flower energy.',price:1,text:'\uD83C\uDF38BlipVibe'},
    {id:'ribbon',name:'Ribbon',desc:'Super cute and sweet.',price:1,text:'\uD83C\uDF80BlipVibe\uD83C\uDF80'},
    {id:'crown',name:'Crown',desc:'Royal and majestic.',price:1,text:'\uD83D\uDC51BlipVibe'},
    {id:'wave',name:'Wave',desc:'Chill ocean flow.',price:1,text:'\uD83C\uDF0ABlipVibe'},
    {id:'rocket',name:'Rocket',desc:'Launch into orbit.',price:1,text:'\uD83D\uDE80BlipVibe'},
    {id:'gem',name:'Diamond',desc:'Rare and precious.',price:1,text:'\uD83D\uDC8EBV\uD83D\uDC8E'},
    {id:'minimal',name:'Minimal',desc:'Less is more.',price:1,text:'bv.'},
    {id:'fire',name:'Fire',desc:'Blazing hot energy.',price:1,text:'\uD83D\uDD25BlipVibe'},
    {id:'star',name:'Starlight',desc:'Shine bright always.',price:1,text:'\u2B50BlipVibe\u2B50'},
    {id:'ghost',name:'Ghost',desc:'Spooky and playful.',price:1,text:'\uD83D\uDC7BBlipVibe'},
    {id:'neon',name:'Neon',desc:'Glowing club vibes.',price:1,text:'\uD83D\uDCA0BV\uD83D\uDCA0'},
    {id:'sword',name:'Sword',desc:'Battle-ready branding.',price:1,text:'\u2694\uFE0FBlipVibe\u2694\uFE0F'}
];

var defaultIcons={home:'fa-home',groups:'fa-users-rectangle',skins:'fa-palette',profiles:'fa-user-group',shop:'fa-store',messages:'fa-envelope',notifications:'fa-bell',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment',share:'fa-share-from-square',search:'fa-search',edit:'fa-pen',bookmark:'fa-bookmark',heart:'fa-heart'};
var activeIcons=JSON.parse(JSON.stringify(defaultIcons));
var iconSets = [
    {id:'rounded',name:'Rounded',desc:'Soft rounded icons.',price:1,preview:'linear-gradient(135deg,#ff9a9e,#fad0c4)',icons:{home:'fa-house',groups:'fa-people-group',skins:'fa-brush',profiles:'fa-address-book',shop:'fa-bag-shopping',messages:'fa-comment-dots',notifications:'fa-bell-concierge',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-message',share:'fa-share-from-square',search:'fa-magnifying-glass',edit:'fa-pen-fancy',bookmark:'fa-flag',heart:'fa-heart'}},
    {id:'techy',name:'Techy',desc:'Futuristic tech icons.',price:1,preview:'linear-gradient(135deg,#667eea,#764ba2)',icons:{home:'fa-microchip',groups:'fa-network-wired',skins:'fa-swatchbook',profiles:'fa-id-card',shop:'fa-cart-shopping',messages:'fa-satellite-dish',notifications:'fa-tower-broadcast',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-share-nodes',search:'fa-magnifying-glass',edit:'fa-wrench',bookmark:'fa-database',heart:'fa-bolt'}},
    {id:'playful',name:'Playful',desc:'Fun and cute icons.',price:1,preview:'linear-gradient(135deg,#f093fb,#f5576c)',icons:{home:'fa-heart',groups:'fa-hands-holding',skins:'fa-wand-magic-sparkles',profiles:'fa-face-smile',shop:'fa-gift',messages:'fa-paper-plane',notifications:'fa-star',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comments',share:'fa-share',search:'fa-wand-magic-sparkles',edit:'fa-pen-nib',bookmark:'fa-star',heart:'fa-face-kiss-wink-heart'}},
    {id:'nature',name:'Nature',desc:'Earth-inspired icons.',price:1,preview:'linear-gradient(135deg,#11998e,#38ef7d)',icons:{home:'fa-tree',groups:'fa-seedling',skins:'fa-leaf',profiles:'fa-sun',shop:'fa-mountain',messages:'fa-wind',notifications:'fa-cloud',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-share-from-square',search:'fa-binoculars',edit:'fa-seedling',bookmark:'fa-tree',heart:'fa-sun'}},
    {id:'cosmic',name:'Cosmic',desc:'Space-themed icons.',price:1,preview:'linear-gradient(135deg,#0f0c29,#302b63)',icons:{home:'fa-rocket',groups:'fa-meteor',skins:'fa-moon',profiles:'fa-globe',shop:'fa-shuttle-space',messages:'fa-satellite',notifications:'fa-explosion',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-arrow-up-from-bracket',search:'fa-user-astronaut',edit:'fa-screwdriver-wrench',bookmark:'fa-moon',heart:'fa-sun'}},
    {id:'medieval',name:'Medieval',desc:'Knights and castles era.',price:1,preview:'linear-gradient(135deg,#8B4513,#D2691E)',icons:{home:'fa-chess-rook',groups:'fa-shield-halved',skins:'fa-scroll',profiles:'fa-helmet-safety',shop:'fa-coins',messages:'fa-dove',notifications:'fa-bell',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-message',share:'fa-hand-holding',search:'fa-compass',edit:'fa-hammer',bookmark:'fa-bookmark',heart:'fa-shield-heart'}},
    {id:'ocean',name:'Ocean',desc:'Deep sea aquatic icons.',price:1,preview:'linear-gradient(135deg,#006994,#00CED1)',icons:{home:'fa-anchor',groups:'fa-fish',skins:'fa-water',profiles:'fa-person-swimming',shop:'fa-ship',messages:'fa-bottle-water',notifications:'fa-otter',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-share-from-square',search:'fa-magnifying-glass',edit:'fa-pen',bookmark:'fa-life-ring',heart:'fa-shrimp'}},
    {id:'retro',name:'Retro',desc:'80s throwback vibes.',price:1,preview:'linear-gradient(135deg,#ff6ec7,#7873f5)',icons:{home:'fa-tv',groups:'fa-compact-disc',skins:'fa-spray-can',profiles:'fa-user-secret',shop:'fa-record-vinyl',messages:'fa-phone',notifications:'fa-radio',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comments',share:'fa-share-nodes',search:'fa-magnifying-glass',edit:'fa-scissors',bookmark:'fa-floppy-disk',heart:'fa-gamepad'}},
    {id:'food',name:'Foodie',desc:'Tasty food-themed icons.',price:1,preview:'linear-gradient(135deg,#ff9a44,#fc6076)',icons:{home:'fa-house-chimney',groups:'fa-utensils',skins:'fa-ice-cream',profiles:'fa-mug-hot',shop:'fa-cart-shopping',messages:'fa-cookie-bite',notifications:'fa-lemon',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-share-from-square',search:'fa-magnifying-glass',edit:'fa-pen',bookmark:'fa-pizza-slice',heart:'fa-candy-cane'}},
    {id:'weather',name:'Weather',desc:'Atmospheric sky icons.',price:1,preview:'linear-gradient(135deg,#89CFF0,#FFD700)',icons:{home:'fa-cloud-sun',groups:'fa-tornado',skins:'fa-rainbow',profiles:'fa-snowman',shop:'fa-umbrella',messages:'fa-snowflake',notifications:'fa-bolt-lightning',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-wind',search:'fa-temperature-half',edit:'fa-droplet',bookmark:'fa-sun',heart:'fa-cloud-moon'}},
    {id:'gamer',name:'Gamer',desc:'Controller-ready gaming icons.',price:1,preview:'linear-gradient(135deg,#7b2ff7,#00f5a0)',icons:{home:'fa-gamepad',groups:'fa-headset',skins:'fa-ghost',profiles:'fa-skull-crossbones',shop:'fa-trophy',messages:'fa-walkie-talkie',notifications:'fa-bell',like:'fa-hand-fist',dislike:'fa-hand-point-down',comment:'fa-comment-dots',share:'fa-share-nodes',search:'fa-crosshairs',edit:'fa-screwdriver-wrench',bookmark:'fa-flag-checkered',heart:'fa-heart-pulse'}},
    {id:'music',name:'Music',desc:'Jam out with musical icons.',price:1,preview:'linear-gradient(135deg,#e91e63,#ff9800)',icons:{home:'fa-music',groups:'fa-guitar',skins:'fa-sliders',profiles:'fa-microphone',shop:'fa-record-vinyl',messages:'fa-headphones',notifications:'fa-volume-high',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-share-from-square',search:'fa-magnifying-glass',edit:'fa-pen',bookmark:'fa-compact-disc',heart:'fa-drum'}},
    {id:'horror',name:'Horror',desc:'Creepy spooky icons.',price:1,preview:'linear-gradient(135deg,#1a1a2e,#6b0000)',icons:{home:'fa-house-chimney-crack',groups:'fa-ghost',skins:'fa-skull',profiles:'fa-mask',shop:'fa-spider',messages:'fa-crow',notifications:'fa-triangle-exclamation',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-share-nodes',search:'fa-eye',edit:'fa-wand-sparkles',bookmark:'fa-cross',heart:'fa-brain'}},
    {id:'fitness',name:'Fitness',desc:'Pump iron with gym icons.',price:1,preview:'linear-gradient(135deg,#ff6b35,#f7dc6f)',icons:{home:'fa-dumbbell',groups:'fa-people-pulling',skins:'fa-shirt',profiles:'fa-person-running',shop:'fa-basket-shopping',messages:'fa-stopwatch',notifications:'fa-bell',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment-dots',share:'fa-share-from-square',search:'fa-magnifying-glass',edit:'fa-pen',bookmark:'fa-medal',heart:'fa-heart-pulse'}},
    {id:'minimal',name:'Minimal',desc:'Clean simple outlines.',price:1,preview:'linear-gradient(135deg,#e0e0e0,#9e9e9e)',icons:{home:'fa-circle',groups:'fa-circle-nodes',skins:'fa-circle-half-stroke',profiles:'fa-circle-user',shop:'fa-circle-dot',messages:'fa-circle-question',notifications:'fa-circle-exclamation',like:'fa-thumbs-up',dislike:'fa-thumbs-down',comment:'fa-comment',share:'fa-up-right-from-square',search:'fa-magnifying-glass',edit:'fa-pen',bookmark:'fa-bookmark',heart:'fa-heart'}}
];

var coinSkins = [
    {id:'diamond',name:'Diamond',desc:'Sparkly diamond coins.',price:1,icon:'fa-gem',color:'#b9f2ff'},
    {id:'star',name:'Star',desc:'Shining star coins.',price:1,icon:'fa-star',color:'#ffd700'},
    {id:'crown',name:'Crown',desc:'Royal crown coins.',price:1,icon:'fa-crown',color:'#f5c518'},
    {id:'fire',name:'Fire',desc:'Blazing fire coins.',price:1,icon:'fa-fire',color:'#ff6b35'},
    {id:'bolt',name:'Bolt',desc:'Electric bolt coins.',price:1,icon:'fa-bolt',color:'#00d4ff'},
    {id:'heart',name:'Heart',desc:'Love-filled coins.',price:1,icon:'fa-heart',color:'#ff69b4'},
    {id:'shield',name:'Shield',desc:'Armored silver coins.',price:1,icon:'fa-shield-halved',color:'#a0aec0'},
    {id:'moon',name:'Moon',desc:'Lunar glow coins.',price:1,icon:'fa-moon',color:'#9b59b6'},
    {id:'leaf',name:'Leaf',desc:'Nature energy coins.',price:1,icon:'fa-leaf',color:'#27ae60'},
    {id:'snowflake',name:'Snowflake',desc:'Frosty ice coins.',price:1,icon:'fa-snowflake',color:'#74b9ff'}
];

var templates = [
    {id:'panorama',name:'Panorama',desc:'Profile banner spans full width. Two-column feed layout below.',price:1,preview:'linear-gradient(135deg,#ff6b6b,#ee5a24)'},
    {id:'compact',name:'Compact',desc:'Centered single-column layout. Everything stacked cleanly.',price:1,preview:'linear-gradient(135deg,#6c5ce7,#a29bfe)'},
    {id:'reverse',name:'Reverse',desc:'Flipped mirror layout. Feed on the right, sidebars swapped.',price:1,preview:'linear-gradient(135deg,#00b894,#00cec9)'},
    {id:'dashboard',name:'Dashboard',desc:'Both sidebars stacked on the left. Wide feed dominates the right.',price:1,preview:'linear-gradient(135deg,#fdcb6e,#e17055)'},
    {id:'cinema',name:'Cinema',desc:'Feed takes center stage full width. Sidebars tucked below.',price:1,preview:'linear-gradient(135deg,#2d3436,#636e72)'},
    {id:'magazine',name:'Magazine',desc:'Profile header up top. Three equal columns below like a news layout.',price:1,preview:'linear-gradient(135deg,#0984e3,#6c5ce7)'},
    {id:'zen',name:'Zen',desc:'Ultra minimal. Just your feed, nothing else. Pure focus mode.',price:1,preview:'linear-gradient(135deg,#dfe6e9,#b2bec3)'},
    {id:'spotlight',name:'Spotlight',desc:'Extra-wide feed, narrow sidebars. Content takes center stage.',price:1,preview:'linear-gradient(135deg,#f39c12,#e74c3c)'},
    {id:'widescreen',name:'Widescreen',desc:'No left sidebar. Feed and right sidebar fill the page.',price:1,preview:'linear-gradient(135deg,#2ecc71,#1abc9c)'},
    {id:'duo',name:'Duo',desc:'Clean two-column split. Profile left, feed right.',price:1,preview:'linear-gradient(135deg,#3498db,#2980b9)'},
    {id:'headline',name:'Headline',desc:'Profile spans the top like a newspaper masthead.',price:1,preview:'linear-gradient(135deg,#9b59b6,#8e44ad)'},
    {id:'stack',name:'Stack',desc:'Full-width stacked layout. Everything in one vertical flow.',price:1,preview:'linear-gradient(135deg,#e67e22,#d35400)'},
    {id:'focus',name:'Focus',desc:'Extra-wide feed with no sidebars. Distraction-free browsing.',price:1,preview:'linear-gradient(135deg,#1abc9c,#16a085)'},
    {id:'grid',name:'Grid',desc:'Two equal columns. Feed and sidebar side by side.',price:1,preview:'linear-gradient(135deg,#8e44ad,#2c3e50)'},
    {id:'journal',name:'Journal',desc:'Narrow centered feed with wide margins. Blog-style reading.',price:1,preview:'linear-gradient(135deg,#f8b500,#e74c3c)'},
    {id:'wing',name:'Wing',desc:'Wide left sidebar with compact feed. Profile-forward layout.',price:1,preview:'linear-gradient(135deg,#00b4db,#0083b0)'},
    {id:'hub',name:'Hub',desc:'Profile and feed centered. Sidebars hidden until hovered.',price:1,preview:'linear-gradient(135deg,#c0392b,#8e44ad)'}
];

var navStyles = [
    {id:'metro',name:'Metro',desc:'App-style vertical sidebar nav. Completely reimagined layout.',price:1,preview:'linear-gradient(135deg,#1e272e,#485460)'},
    {id:'dock',name:'Dock',desc:'Mobile app-style bottom navigation dock with slim top header.',price:1,preview:'linear-gradient(135deg,#0f3460,#16213e)'},
    {id:'float',name:'Float',desc:'Floating glass navbar with rounded corners. Minimal and premium.',price:1,preview:'linear-gradient(135deg,#667eea,#764ba2)'},
    {id:'pill',name:'Pill',desc:'Floating pill at bottom center. Icons only. Ultra minimal.',price:1,preview:'linear-gradient(135deg,#e91e63,#9c27b0)'},
    {id:'rail',name:'Rail',desc:'Thin icon-only sidebar. Compact and space-efficient.',price:1,preview:'linear-gradient(135deg,#455a64,#263238)'},
    {id:'shelf',name:'Shelf',desc:'Double-row top bar with tabbed navigation row below.',price:1,preview:'linear-gradient(135deg,#00897b,#004d40)'},
    {id:'slim',name:'Slim',desc:'Ultra-thin 36px bar. Maximum content space.',price:1,preview:'linear-gradient(135deg,#5c6bc0,#283593)'},
    {id:'horizon',name:'Horizon',desc:'Full navbar moved to the bottom of the screen.',price:1,preview:'linear-gradient(135deg,#f4511e,#bf360c)'},
    {id:'mirror',name:'Mirror',desc:'Right-side vertical sidebar. Flipped Metro layout.',price:1,preview:'linear-gradient(135deg,#26a69a,#00695c)'},
    {id:'island',name:'Island',desc:'Three floating islands. Logo, nav, and user all separate.',price:1,preview:'linear-gradient(135deg,#42a5f5,#0d47a1)'},
    {id:'ribbon',name:'Ribbon',desc:'Thin colored ribbon across the top with centered icons.',price:1,preview:'linear-gradient(135deg,#e91e63,#f06292)'},
    {id:'glass',name:'Glass',desc:'Transparent frosted glass bar. Content shows through.',price:1,preview:'linear-gradient(135deg,#b2ebf2,#80deea)'},
    {id:'split',name:'Split',desc:'Logo left, nav bottom. Two separate bars.',price:1,preview:'linear-gradient(135deg,#ff7043,#d84315)'},
    {id:'minimal',name:'Minimal',desc:'Just icons. No background. Invisible until hover.',price:1,preview:'linear-gradient(135deg,#cfd8dc,#90a4ae)'},
    {id:'arcade',name:'Arcade',desc:'Chunky pixel-style bar. Retro gaming feel.',price:1,preview:'linear-gradient(135deg,#7b2ff7,#00f5a0)'}
];

var premiumSkins = [
    {id:'witchcraft',name:'Witchcraft',desc:'Mystical witch symbols with moonlit purple aura. Enchanting and magical.',price:1,preview:'linear-gradient(135deg,#2d1b69,#11001c)',border:'conic-gradient(from 0deg,#8b5cf6,#c084fc,#a855f7,#7c3aed,#8b5cf6)',icon:'fa-hat-wizard',iconColor:'#c084fc',accent:'#c084fc',accentHover:'#a855f7',dark:true},
    {id:'anime-blaze',name:'Anime Blaze',desc:'Fiery anime-inspired theme with blazing red and orange energy.',price:1,preview:'linear-gradient(135deg,#ff0844,#ffb199)',border:'conic-gradient(from 45deg,#ff0844,#ff6b6b,#ffb199,#ff0844)',icon:'fa-fire',iconColor:'#ff6b6b',accent:'#ff4444',accentHover:'#cc0033',dark:true},
    {id:'kawaii-cats',name:'Kawaii Cats',desc:'Adorable pink cat-themed design. Purrfectly cute for cat lovers.',price:1,preview:'linear-gradient(135deg,#fbc2eb,#a6c1ee)',border:'conic-gradient(from 0deg,#fbc2eb,#f8a4d2,#a6c1ee,#fbc2eb)',icon:'fa-cat',iconColor:'#f8a4d2',accent:'#e91e8c',accentHover:'#c2185b',dark:false},
    {id:'geo-prism',name:'Geo Prism',desc:'Sharp geometric shapes with prismatic rainbow refraction.',price:1,preview:'linear-gradient(135deg,#00c9ff,#92fe9d)',border:'conic-gradient(from 0deg,#ff0000,#ff8800,#ffff00,#00ff00,#0088ff,#8800ff,#ff0000)',icon:'fa-shapes',iconColor:'#00c9ff',accent:'#4f46e5',accentHover:'#4338ca',dark:false},
    {id:'autumn-leaves',name:'Autumn Leaves',desc:'Warm fall foliage tones. Golden amber and rustic reds.',price:1,preview:'linear-gradient(135deg,#f12711,#f5af19)',border:'conic-gradient(from 30deg,#f5af19,#f12711,#c0392b,#e67e22,#f5af19)',icon:'fa-leaf',iconColor:'#f5af19',accent:'#d35400',accentHover:'#b84500',dark:false},
    {id:'neon-wave',name:'Neon Wave',desc:'Electric neon gradient that pulses with cyberpunk energy.',price:1,preview:'linear-gradient(135deg,#00f5a0,#7b2ff7)',border:'conic-gradient(from 0deg,#00f5a0,#00d9f5,#7b2ff7,#f500e5,#00f5a0)',icon:'fa-bolt',iconColor:'#00f5a0',accent:'#00f5a0',accentHover:'#00cc88',dark:true},
    {id:'sakura',name:'Sakura Bloom',desc:'Delicate cherry blossom pink with soft floral elegance.',price:1,preview:'linear-gradient(135deg,#ffecd2,#fcb69f)',border:'conic-gradient(from 0deg,#fcb69f,#ff9a9e,#ffecd2,#f8b4b4,#fcb69f)',icon:'fa-spa',iconColor:'#ff9a9e',accent:'#e11d73',accentHover:'#be185d',dark:false},
    {id:'galaxy',name:'Galaxy Swirl',desc:'Deep space nebula with cosmic purples and stellar blues.',price:1,preview:'linear-gradient(135deg,#0c0032,#6e0dd0)',border:'conic-gradient(from 0deg,#6e0dd0,#240090,#0c0032,#3500d3,#6e0dd0)',icon:'fa-star',iconColor:'#b388ff',accent:'#a855f7',accentHover:'#9333ea',dark:true},
    {id:'ocean-tide',name:'Ocean Tide',desc:'Flowing ocean waves with deep aqua and seafoam gradients.',price:1,preview:'linear-gradient(135deg,#0077b6,#90e0ef)',border:'conic-gradient(from 0deg,#0077b6,#00b4d8,#90e0ef,#caf0f8,#0077b6)',icon:'fa-water',iconColor:'#90e0ef',accent:'#0891b2',accentHover:'#0e7490',dark:false},
    {id:'molten-gold',name:'Molten Gold',desc:'Liquid gold with luxurious metallic shimmer. Pure opulence.',price:1,preview:'linear-gradient(135deg,#bf953f,#fcf6ba)',border:'conic-gradient(from 0deg,#bf953f,#fcf6ba,#b38728,#fbf5b7,#bf953f)',icon:'fa-crown',iconColor:'#fcf6ba',accent:'#f59e0b',accentHover:'#d97706',dark:true},
    {id:'toxic-green',name:'Toxic Green',desc:'Radioactive neon green on pitch black. Dangerously cool.',price:1,preview:'linear-gradient(135deg,#0a0a0a,#39ff14)',border:'conic-gradient(from 0deg,#39ff14,#00ff41,#32cd32,#00ff00,#39ff14)',icon:'fa-biohazard',iconColor:'#39ff14',accent:'#39ff14',accentHover:'#32cd32',dark:true},
    {id:'vaporwave',name:'Vaporwave',desc:'Retro 80s pink and cyan. Nostalgic aesthetic vibes.',price:1,preview:'linear-gradient(135deg,#ff71ce,#01cdfe)',border:'conic-gradient(from 0deg,#ff71ce,#01cdfe,#b967ff,#05ffa1,#ff71ce)',icon:'fa-vr-cardboard',iconColor:'#ff71ce',accent:'#b967ff',accentHover:'#9b4dca',dark:true},
    {id:'blood-moon',name:'Blood Moon',desc:'Deep crimson and obsidian. Dark and brooding intensity.',price:1,preview:'linear-gradient(135deg,#1a0000,#8b0000)',border:'conic-gradient(from 0deg,#8b0000,#cc0000,#660000,#990000,#8b0000)',icon:'fa-moon',iconColor:'#cc0000',accent:'#cc0000',accentHover:'#990000',dark:true},
    {id:'cotton-candy',name:'Cotton Candy',desc:'Soft pastel pink and baby blue. Sweet and dreamy.',price:1,preview:'linear-gradient(135deg,#ffd1dc,#b5e8ff)',border:'conic-gradient(from 0deg,#ffd1dc,#b5e8ff,#e8d5f5,#ffd1dc)',icon:'fa-cloud',iconColor:'#ffa6c9',accent:'#e91e8c',accentHover:'#c2185b',dark:false},
    {id:'matrix',name:'Matrix',desc:'Digital rain green on black. Enter the simulation.',price:1,preview:'linear-gradient(135deg,#000000,#003300)',border:'conic-gradient(from 0deg,#00ff41,#008f11,#00ff41,#003300,#00ff41)',icon:'fa-terminal',iconColor:'#00ff41',accent:'#00ff41',accentHover:'#00cc33',dark:true}
];

var guildSkins = [
    {id:'guild-banner',name:'Guild Banner',desc:'Medieval guild banner theme with heraldic colors.',price:50,preview:'linear-gradient(135deg,#8B4513,#DAA520)',cardBg:'#f5e6d0',cardText:'#5c3310',cardMuted:'#8B6914'},
    {id:'guild-fortress',name:'Fortress',desc:'Stone castle walls and iron gates. Impenetrable style.',price:75,preview:'linear-gradient(135deg,#4a4a4a,#7a7a7a)',cardBg:'#e8e8e8',cardText:'#333',cardMuted:'#666'},
    {id:'guild-dragon',name:'Dragon\'s Lair',desc:'Fiery dragon scales with smoldering ember accents.',price:100,preview:'linear-gradient(135deg,#8b0000,#ff4500)',cardBg:'#2a0a0a',cardText:'#ff6b35',cardMuted:'#cc4400'},
    {id:'guild-enchanted',name:'Enchanted Grove',desc:'Mystical forest with glowing fairy dust particles.',price:75,preview:'linear-gradient(135deg,#1a472a,#2d8659)',cardBg:'#e8f5e9',cardText:'#1a472a',cardMuted:'#2d8659'},
    {id:'guild-ocean',name:'Pirate Cove',desc:'Seafaring adventure with treasure map aesthetics.',price:50,preview:'linear-gradient(135deg,#1a3a5c,#2980b9)',cardBg:'#e3f2fd',cardText:'#1a3a5c',cardMuted:'#2471a3'},
    {id:'guild-celestial',name:'Celestial Order',desc:'Heavenly starlight with divine golden halos.',price:100,preview:'linear-gradient(135deg,#1a1a3e,#4a0080)',cardBg:'#1e1e3a',cardText:'#e8d5ff',cardMuted:'#b388ff'},
    {id:'guild-steampunk',name:'Steampunk Works',desc:'Clockwork gears and brass pipes. Industrial elegance.',price:75,preview:'linear-gradient(135deg,#5c3a1e,#b87333)',cardBg:'#f5e6d0',cardText:'#5c3a1e',cardMuted:'#b87333'},
    {id:'guild-frost',name:'Frost Legion',desc:'Icy blue with frozen crystal formations.',price:50,preview:'linear-gradient(135deg,#0a2a4a,#00bcd4)',cardBg:'#e0f7fa',cardText:'#006064',cardMuted:'#00838f'}
];

var gfLink=document.createElement('link');gfLink.rel='stylesheet';gfLink.href='https://fonts.googleapis.com/css2?family=Orbitron&family=Rajdhani&family=Quicksand&family=Pacifico&family=Baloo+2&display=swap';document.head.appendChild(gfLink);


// ======================== UTILITIES ========================
function $(sel){return document.querySelector(sel);}
function $$(sel){return document.querySelectorAll(sel);}
function fmtNum(n){return n>=1000?(n/1000).toFixed(1)+'k':n.toString();}
function timeAgo(i){
    var units=['just now','1 min ago','5 min ago','15 min ago','30 min ago','1 hr ago','2 hrs ago','3 hrs ago','5 hrs ago','8 hrs ago','12 hrs ago','1 day ago','2 days ago','3 days ago','5 days ago','1 week ago'];
    return units[i%units.length];
}

// ======================== NAVIGATION ========================
var _pvSaved=null;
var _gvSaved=null;
var _navCurrent='home';var _navPrev='home';
function navigateTo(page){
    // Restore user's skin/font/template when leaving profile view
    if(_pvSaved&&page!=='profile-view'){
        premiumBgImage=_pvSaved.bgImage;premiumBgSaturation=_pvSaved.bgSat;
        state.activePremiumSkin=_pvSaved.premiumSkin||null;
        applySkin(_pvSaved.skin||null,true);applyFont(_pvSaved.font||null,true);applyTemplate(_pvSaved.tpl||null,true);
        if(_pvSaved.premiumSkin)applyPremiumSkin(_pvSaved.premiumSkin,true);
        else updatePremiumBg();
        _pvSaved=null;
    }
    // Restore user's skin when leaving group view
    if(_gvSaved){
        premiumBgImage=_gvSaved.bgImage;premiumBgSaturation=_gvSaved.bgSat;
        if(_gvSaved.premiumSkin) applyPremiumSkin(_gvSaved.premiumSkin,true);
        else{applySkin(_gvSaved.skin||null,true);updatePremiumBg();}
        _gvSaved=null;
    }
    $$('.page').forEach(function(p){p.classList.remove('active');});
    var target=document.getElementById('page-'+page);
    if(target) target.classList.add('active');
    $$('.nav-link').forEach(function(l){l.classList.remove('active');});
    $$('.nav-link[data-page="'+page+'"]').forEach(function(l){l.classList.add('active');});
    $('#userDropdownMenu').classList.remove('show');
    $$('.post-dropdown.show').forEach(function(m){m.classList.remove('show');});
    closeModal();
    window.scrollTo(0,0);
    if(page==='notifications'){
        state.notifications.forEach(function(n){n.read=true;});
        updateNotifBadge();
        renderNotifications();
        if(currentUser) sbMarkNotificationsRead(currentUser.id).catch(function(){});
    }
    if(page==='messages') loadConversations();
    if(page==='profiles') renderProfiles(currentProfileTab);
    if(page==='groups') renderGroups();
    if(page==='shop') renderShop();
    if(page==='skins') renderMySkins();
    if(page==='photos') renderPhotoAlbum();
    if(page==='saved') renderSavedPage();
    _navPrev=_navCurrent;_navCurrent=page;
}

document.addEventListener('click',function(e){
    var link=e.target.closest('[data-page]');
    if(link){
        e.preventDefault();
        navigateTo(link.getAttribute('data-page'));
    }
    // Close dropdowns
    if(!e.target.closest('.post-menu-btn')&&!e.target.closest('.post-dropdown')){
        $$('.post-dropdown.show').forEach(function(m){m.classList.remove('show');});
    }
    if(!e.target.closest('.nav-user')){
        $('#userDropdownMenu').classList.remove('show');
    }
});

// User dropdown
$('#navUserDropdown').addEventListener('click',function(e){
    if(!e.target.closest('.user-dropdown a')) $('#userDropdownMenu').classList.toggle('show');
});

// Global search - open search results page on Enter
$('#globalSearch').addEventListener('keydown',function(e){
    if(e.key==='Enter'){
        var q=this.value.trim();
        if(q.length>0) performSearch(q);
    }
});

var currentSearchQuery='';
var currentSearchTab='people';

function performSearch(q){
    currentSearchQuery=q;
    currentSearchTab='people';
    navigateTo('search');
    $('#searchQuery').textContent='Results for "'+q+'"';
    // Update tab active states
    $$('.search-tab').forEach(function(t){t.classList.toggle('active',t.dataset.tab==='people');});
    renderSearchResults(q,'people');
}

// Search tab clicks
document.addEventListener('click',function(e){
    var tab=e.target.closest('.search-tab');
    if(tab && currentSearchQuery){
        currentSearchTab=tab.dataset.tab;
        $$('.search-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');
        renderSearchResults(currentSearchQuery,currentSearchTab);
    }
});

async function renderSearchResults(q,tab){
    var ql=q.toLowerCase();
    var container=$('#searchResults');
    var html='';

    // Fetch results from Supabase
    var peopleResults=[];
    try { peopleResults=await sbSearchProfiles(q, 20); } catch(e){}
    var groupResults=groups.filter(function(g){return g.name.toLowerCase().indexOf(ql)!==-1||(g.description||'').toLowerCase().indexOf(ql)!==-1;});
    // Post results counted from loaded feed
    var postResults=feedPosts.filter(function(p){return p.text.toLowerCase().indexOf(ql)!==-1;});

    // Update tab counts
    $$('.search-tab').forEach(function(t){
        var count=0;
        if(t.dataset.tab==='people') count=peopleResults.length;
        else if(t.dataset.tab==='groups') count=groupResults.length;
        else if(t.dataset.tab==='posts') count=postResults.length;
        var badge=t.querySelector('.tab-count');
        if(badge) badge.textContent=count;
        else{var sp=document.createElement('span');sp.className='tab-count';sp.textContent=count;t.appendChild(sp);}
    });

    if(tab==='people'){
        if(!peopleResults.length){html='<div class="empty-state"><i class="fas fa-user-slash"></i><p>No people found for "'+q+'"</p></div>';}
        else{html='<div class="search-results-grid">';peopleResults.forEach(function(p){html+=profileCardHtml({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url});});html+='</div>';}
        container.innerHTML=html;
        bindProfileEvents('#searchResults');
    } else if(tab==='groups'){
        if(!groupResults.length){html='<div class="empty-state"><i class="fas fa-users-slash"></i><p>No groups found for "'+q+'"</p></div>';}
        else{html='<div class="search-results-grid">';groupResults.forEach(function(g){html+=groupCardHtml(g);});html+='</div>';}
        container.innerHTML=html;
        bindGroupEvents('#searchResults');
    } else if(tab==='posts'){
        // Search posts from feed
        var postResults=feedPosts.filter(function(p){return p.text.toLowerCase().indexOf(ql)!==-1;});
        if(!postResults.length){html='<div class="empty-state"><i class="fas fa-file-circle-xmark"></i><p>No posts found for "'+q+'"</p></div>';}
        else{
            postResults.forEach(function(fp){
                var person=fp.person;
                var text=fp.text;
                var tags=fp.tags||[];
                var badge=fp.badge||badgeTypes[0];
                var short=text.substring(0,200);
                var rest=text.substring(200);
                var hasMore=rest.length>0;
                html+='<div class="card feed-post search-post-card">';
                var avatarSrc=person.avatar_url||DEFAULT_AVATAR;
                html+='<div class="post-header"><img src="'+avatarSrc+'" alt="'+person.name+'" class="post-avatar" data-person-id="'+person.id+'">';
                html+='<div class="post-user-info"><div class="post-user-top"><h4 class="post-username" data-person-id="'+person.id+'">'+person.name+'</h4><span class="post-time">'+(fp.created_at?timeAgoReal(fp.created_at):'')+'</span></div>';
                html+='<div class="post-badges"><span class="badge '+badge.cls+'"><i class="fas '+badge.icon+'"></i> '+badge.text+'</span></div></div></div>';
                html+='<div class="post-description"><p>'+short+(hasMore?'<span class="view-more-text hidden">'+rest+'</span>':'')+'</p>'+(hasMore?'<button class="view-more-btn">view more</button>':'')+'</div>';
                html+='<div class="post-tags">';
                tags.forEach(function(t){html+='<span class="skill-tag">'+t+'</span>';});
                html+='</div></div>';
            });
        }
        container.innerHTML=html;
        // Bind view more buttons in search results
        $$('#searchResults .view-more-btn').forEach(function(btn){
            btn.addEventListener('click',function(){
                var span=btn.parentElement.querySelector('.view-more-text');
                if(span.classList.contains('hidden')){span.classList.remove('hidden');btn.textContent='view less';}
                else{span.classList.add('hidden');btn.textContent='view more';}
            });
        });
        // Bind username clicks to profile view
        $$('#searchResults .post-username, #searchResults .post-avatar').forEach(function(el){
            el.addEventListener('click',async function(){
                var uid=el.dataset.personId;
                if(uid){try{var p=await sbGetProfile(uid);if(p) showProfileView(profileToPerson(p));}catch(e){}}
            });
        });
    }
}

// ======================== COIN SYSTEM ========================
function updateCoins(){
    if(currentUser){
        currentUser.coin_balance=state.coins;
        sbUpdateProfile(currentUser.id,{coin_balance:state.coins}).catch(function(e){console.error('coinSync:',e);});
    }
    $('#navCoinCount').textContent=state.coins;
    var el=$('#navCoins');
    el.classList.remove('coin-pop');
    void el.offsetWidth;
    el.classList.add('coin-pop');
}
function addGroupCoins(groupId,amount){
    if(!state.groupCoins[groupId]) state.groupCoins[groupId]=0;
    state.groupCoins[groupId]+=amount;
    var el=document.getElementById('gvGroupCoinCount');
    if(el) el.textContent=state.groupCoins[groupId]||0;
    var el2=document.getElementById('gvGroupCoinCount2');
    if(el2) el2.textContent=state.groupCoins[groupId]||0;
    var coinWrap=document.getElementById('gvGroupCoins');
    if(coinWrap){coinWrap.classList.remove('coin-pop');void coinWrap.offsetWidth;coinWrap.classList.add('coin-pop');}
}
function getGroupCoinCount(groupId){return state.groupCoins[groupId]||0;}
function getTodayKey(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function canEarnGroupPostCoin(groupId){
    var dayKey=getTodayKey();
    if(!state.groupPostCoinCount[groupId]) state.groupPostCoinCount[groupId]={};
    return (state.groupPostCoinCount[groupId][dayKey]||0)<10;
}
function trackGroupPostCoin(groupId){
    var dayKey=getTodayKey();
    if(!state.groupPostCoinCount[groupId]) state.groupPostCoinCount[groupId]={};
    if(!state.groupPostCoinCount[groupId][dayKey]) state.groupPostCoinCount[groupId][dayKey]=0;
    state.groupPostCoinCount[groupId][dayKey]++;
}
function canEarnGroupCommentCoin(groupId,postId){
    if(!state.groupCommentCoinPosts[groupId]) state.groupCommentCoinPosts[groupId]={};
    return !state.groupCommentCoinPosts[groupId][postId];
}
function trackGroupCommentCoin(groupId,postId){
    if(!state.groupCommentCoinPosts[groupId]) state.groupCommentCoinPosts[groupId]={};
    state.groupCommentCoinPosts[groupId][postId]=true;
}
function canEarnGroupReplyCoin(groupId,postId){
    if(!state.groupReplyCoinPosts[groupId]) state.groupReplyCoinPosts[groupId]={};
    return !state.groupReplyCoinPosts[groupId][postId];
}
function trackGroupReplyCoin(groupId,postId){
    if(!state.groupReplyCoinPosts[groupId]) state.groupReplyCoinPosts[groupId]={};
    state.groupReplyCoinPosts[groupId][postId]=true;
}

$('#navCoins').addEventListener('click',function(){
    $('#userDropdownMenu').classList.remove('show');
    navigateTo('shop');
});

// ======================== FOLLOW SYSTEM ========================
function updateFollowCounts(){
    $('#followingCount').textContent=state.following;
    $('#followersCount').textContent=state.followers;
}

function updateStatClickable(){
    var priv=state.privateFollowers;
    $('#followingStat').style.opacity=priv?'.5':'';
    $('#followingStat').style.pointerEvents=priv?'none':'';
    $('#followersStat').style.opacity=priv?'.5':'';
    $('#followersStat').style.pointerEvents=priv?'none':'';
}

async function toggleFollow(userId,btn){
    if(blockedUsers[userId]) return;
    if(!currentUser) return;
    try {
        if(state.followedUsers[userId]){
            await sbUnfollow(currentUser.id, userId);
            delete state.followedUsers[userId];
            state.following--;
            if(btn){
                btn.classList.remove('followed','btn-disabled');
                btn.classList.add('btn-green');
                btn.innerHTML=btn.classList.contains('follow-btn-small')?'<i class="fas fa-plus"></i>':'<i class="fas fa-plus"></i> Follow';
            }
        } else {
            await sbFollow(currentUser.id, userId);
            state.followedUsers[userId]=true;
            state.following++;
            if(btn){
                btn.classList.add('followed');
                btn.classList.remove('btn-green');
                btn.classList.add('btn-disabled');
                btn.innerHTML=btn.classList.contains('follow-btn-small')?'<i class="fas fa-check"></i>':'<i class="fas fa-check"></i> Following';
            }
            sbGetProfile(userId).then(function(p){if(p)addNotification('follow','You are now following '+(p.display_name||p.username));}).catch(function(){});
        }
        updateFollowCounts();
        renderSuggestions();
    } catch(err) { console.error('toggleFollow:', err); }
}

// ======================== NOTIFICATIONS ========================
var activeNotifTab='all';
var notifTabDefs=[
    {key:'all',label:'<i class="fas fa-bell"></i> All',filter:null},
    {key:'comment',label:'<i class="fas fa-comment"></i> Comments',filter:function(n){return n.type==='comment';}},
    {key:'reply',label:'<i class="fas fa-reply"></i> Replies',filter:function(n){return n.type==='reply';}},
    {key:'like',label:'<i class="fas fa-heart"></i> Likes',filter:function(n){return n.type==='like';}},
    {key:'follow',label:'<i class="fas fa-user-plus"></i> Follows',filter:function(n){return n.type==='follow';}},
    {key:'message',label:'<i class="fas fa-envelope"></i> Messages',filter:function(n){return n.type==='message';}},
    {key:'system',label:'<i class="fas fa-cog"></i> System',filter:function(n){return n.type==='system'||n.type==='skin'||n.type==='group'||n.type==='coin';}}
];
function addNotification(type,text){
    state.notifications.unshift({type:type,text:text,time:new Date().toLocaleTimeString(),read:false});
    updateNotifBadge();
    renderNotifications();
    // Persist to Supabase
    if(currentUser){
        sbCreateNotification(currentUser.id,type,text,'').catch(function(e){console.warn('Notif save error:',e);});
    }
}
function updateNotifBadge(){
    var unread=state.notifications.filter(function(n){return !n.read;}).length;
    var badge=$('#notifBadge');
    if(unread>0){badge.style.display='flex';badge.textContent=unread;}
    else{badge.style.display='none';}
}
function getNotifIcon(type){
    var map={comment:{cls:'skin',icon:'fa-comment'},reply:{cls:'skin',icon:'fa-reply'},like:{cls:'coin',icon:'fa-heart'},follow:{cls:'follow',icon:'fa-user-plus'},message:{cls:'group',icon:'fa-envelope'},system:{cls:'coin',icon:'fa-cog'},skin:{cls:'skin',icon:'fa-palette'},group:{cls:'group',icon:'fa-users'},coin:{cls:'coin',icon:'fa-coins'}};
    return map[type]||{cls:'coin',icon:'fa-bell'};
}
function renderNotifications(){
    // Render tabs
    var tabsContainer=$('#notifTabs');
    if(tabsContainer){
        var tabsHtml='';
        notifTabDefs.forEach(function(t){
            var count=t.filter?state.notifications.filter(t.filter).length:state.notifications.length;
            tabsHtml+='<button class="search-tab'+(t.key===activeNotifTab?' active':'')+'" data-ntab="'+t.key+'">'+t.label+(count>0?' <span class="tab-count">'+count+'</span>':'')+'</button>';
        });
        tabsContainer.innerHTML=tabsHtml;
        $$('#notifTabs .search-tab').forEach(function(tab){
            tab.addEventListener('click',function(){
                activeNotifTab=tab.dataset.ntab;
                $$('#notifTabs .search-tab').forEach(function(t){t.classList.remove('active');});
                tab.classList.add('active');
                renderNotifications();
            });
        });
    }
    // Render filtered list
    var container=$('#notifList');
    var activeTab=notifTabDefs.find(function(t){return t.key===activeNotifTab;});
    var filtered=activeTab&&activeTab.filter?state.notifications.filter(activeTab.filter):state.notifications;
    if(filtered.length===0){
        container.innerHTML='<div class="empty-state"><i class="fas fa-bell-slash"></i><p>No notifications in this category.</p></div>';
        return;
    }
    var html='';
    filtered.forEach(function(n){
        var ic=getNotifIcon(n.type);
        html+='<div class="notif-item"><div class="notif-icon '+ic.cls+'"><i class="fas '+ic.icon+'"></i></div><div class="notif-text"><p>'+n.text+'</p><span>'+n.time+'</span></div></div>';
    });
    container.innerHTML=html;
}

// ======================== MODAL ========================
function showModal(html){
    $('#modalContent').innerHTML=html;
    $('#modalOverlay').classList.add('show');
    document.body.style.overflow='hidden';
}
function closeModal(){
    $('#modalOverlay').classList.remove('show');
    document.body.style.overflow='';
}
$('#modalOverlay').addEventListener('click',function(e){
    if(e.target===this) closeModal();
});
document.addEventListener('click',function(e){
    if(e.target.closest('.modal-close')) closeModal();
});

function handleShare(btn){
    var post=btn.closest('.feed-post')||btn.closest('.card');
    if(!post)return;
    var avatar=post.querySelector('.post-avatar');
    var username=post.querySelector('.post-username');
    var time=post.querySelector('.post-time');
    var desc=post.querySelector('.post-description');
    var origAvatar=avatar?avatar.src:'';
    var origName=username?username.textContent:'Unknown';
    var origTime=time?time.textContent:'';
    var origText=desc?desc.innerHTML:'';
    // Get the original post UUID from the like button's data-post-id
    var likeBtn=post.querySelector('.like-btn');
    var origPostId=likeBtn?likeBtn.getAttribute('data-post-id'):null;
    var html='<div class="modal-header"><h3>Share Post</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body"><textarea id="shareComment" class="share-textarea" placeholder="Add your thoughts..."></textarea>';
    html+='<div class="share-preview">';
    html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><img src="'+origAvatar+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;"><strong class="share-preview-name" style="font-size:13px;">'+origName+'</strong><span class="share-preview-time" style="font-size:12px;">'+origTime+'</span></div>';
    html+='<div class="share-preview-text" style="font-size:13px;">'+origText+'</div></div>';
    html+='<button id="sharePublishBtn" class="btn btn-primary" style="width:100%;margin-top:12px;">Share</button></div>';
    showModal(html);
    document.getElementById('sharePublishBtn').addEventListener('click',async function(){
        var comment=document.getElementById('shareComment').value.trim();
        var shareContent=comment||'Shared a post';
        var isUUID=origPostId&&/^[0-9a-f]{8}-/.test(origPostId);
        // Save to Supabase
        if(isUUID&&currentUser){
            try{
                await sbCreatePost(currentUser.id,shareContent,null,null,origPostId);
                if(state.postCoinCount<10){state.coins+=5;state.postCoinCount++;updateCoins();}
                var countEl=btn.querySelector('span');if(countEl)countEl.textContent=parseInt(countEl.textContent)+1;
                closeModal();
                showToast('Post shared!');
                // Refresh feed to show the new shared post
                await generatePosts();
            }catch(e){
                console.error('Share error:',e);
                showToast('Share failed: '+(e.message||'Unknown error'));
            }
        } else {
            // Fallback: local-only share for non-Supabase posts
            var container=$('#feedContainer');
            var postId='share-'+Date.now();
            var ph='<div class="card feed-post"><div class="post-header"><img src="'+getMyAvatar()+'" alt="You" class="post-avatar">';
            ph+='<div class="post-user-info"><div class="post-user-top"><h4 class="post-username">'+(currentUser?(currentUser.display_name||currentUser.username):'You')+'</h4><span class="post-time">just now</span></div>';
            ph+='<div class="post-badges"><span class="badge badge-green"><i class="fas fa-share"></i> Shared</span></div></div></div>';
            if(comment) ph+='<div class="post-description"><p>'+comment.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p></div>';
            ph+='<div class="share-preview" style="margin:0 0 14px;">';
            ph+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><img src="'+origAvatar+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;"><strong class="share-preview-name" style="font-size:13px;">'+origName+'</strong><span class="share-preview-time" style="font-size:12px;">'+origTime+'</span></div>';
            ph+='<div class="share-preview-text" style="font-size:13px;">'+origText+'</div></div>';
            ph+='<div class="post-actions"><div class="action-left"><button class="action-btn like-btn" data-post-id="'+postId+'"><i class="far '+activeIcons.like+'"></i><span class="like-count">0</span></button>';
            ph+='<button class="action-btn dislike-btn" data-post-id="'+postId+'"><i class="far '+activeIcons.dislike+'"></i><span class="dislike-count">0</span></button>';
            ph+='<button class="action-btn comment-btn"><i class="far '+activeIcons.comment+'"></i><span>0</span></button>';
            ph+='<button class="action-btn share-btn"><i class="fas '+activeIcons.share+'"></i><span>0</span></button></div></div>';
            ph+='<div class="post-comments" data-post-id="'+postId+'"></div></div>';
            container.insertAdjacentHTML('afterbegin',ph);
            if(state.postCoinCount<10){state.coins+=5;state.postCoinCount++;updateCoins();}
            closeModal();
            var countEl2=btn.querySelector('span');if(countEl2)countEl2.textContent=parseInt(countEl2.textContent)+1;
            bindPostEvents();
        }
    });
}

function buildCommentHtml(cid,name,img,text,likes,isReply){
    var liked=likedComments[cid];var lc=likes+(liked?1:0);
    var disliked=dislikedComments[cid];var dc=disliked?1:0;
    var avatarSrc=img||DEFAULT_AVATAR;
    var sz=isReply?'28':'32';
    var h='<div class="comment-item'+(isReply?' comment-reply':'')+'" data-cid="'+cid+'">';
    h+='<img src="'+avatarSrc+'" style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;flex-shrink:0;">';
    h+='<div style="flex:1;"><strong style="font-size:13px;">'+name+'</strong>';
    h+='<p style="font-size:13px;color:#555;margin-top:2px;">'+text+'</p>';
    h+='<div class="comment-actions-row" style="display:flex;gap:10px;margin-top:4px;">';
    h+='<button class="comment-like-btn" data-cid="'+cid+'" style="background:none;font-size:12px;color:'+(liked?'var(--primary)':'#999')+';display:flex;align-items:center;gap:4px;"><i class="'+(liked?'fas':'far')+' fa-thumbs-up"></i><span>'+lc+'</span></button>';
    h+='<button class="comment-dislike-btn" data-cid="'+cid+'" style="background:none;font-size:12px;color:'+(disliked?'var(--primary)':'#999')+';display:flex;align-items:center;gap:4px;"><i class="'+(disliked?'fas':'far')+' fa-thumbs-down"></i><span>'+dc+'</span></button>';
    h+='<button class="comment-reply-btn" data-cid="'+cid+'" style="background:none;font-size:12px;color:#999;cursor:pointer;"><i class="far fa-comment"></i> Reply</button>';
    h+='</div></div></div>';
    return h;
}


async function showComments(postId,countEl,sortMode){
    sortMode=sortMode||settings.commentOrder||'top';
    var allComments=[];
    var isUUID=/^[0-9a-f]{8}-/.test(postId);
    // Load comments from Supabase for real posts
    if(isUUID){
        try{
            var sbComments=await sbGetComments(postId,sortMode);
            (sbComments||[]).forEach(function(c){
                var authorName=(c.author?c.author.display_name||c.author.username:'User');
                var authorAvatar=(c.author?c.author.avatar_url:null);
                var likeCount=c.like_count||0;
                allComments.push({cid:c.id,name:authorName,img:authorAvatar,text:c.content,likes:likeCount,parentId:c.parent_comment_id,authorId:c.author_id});
            });
        }catch(e){
            console.error('Load comments error:',e);
            // Fallback: use lite query
            try{
                var fallbackComments=await sbGetCommentsLite(postId,50);
                fallbackComments.forEach(function(c){
                    var authorName=(c.author?c.author.display_name||c.author.username:'User');
                    var authorAvatar=(c.author?c.author.avatar_url:null);
                    allComments.push({cid:c.id,name:authorName,img:authorAvatar,text:c.content,likes:0,parentId:c.parent_comment_id,authorId:c.author_id});
                });
            }catch(e2){console.error('Fallback comments error:',e2);}
        }
    }
    // Also include local-only comments (for non-UUID posts or as fallback)
    if(!isUUID){
        var user=state.comments[postId]||[];
        var _myName=currentUser?(currentUser.display_name||currentUser.username):'You';
        user.forEach(function(t,i){allComments.push({cid:postId+'-u-'+i,name:_myName,img:null,text:t,likes:0,parentId:null});});
        if(sortMode==='top'){allComments.sort(function(a,b){return b.likes-a.likes;});}
        else if(sortMode==='newest'){allComments.reverse();}
    }
    // Separate top-level and replies
    var topLevel=allComments.filter(function(c){return !c.parentId;});
    var repliesByParent={};
    allComments.filter(function(c){return c.parentId;}).forEach(function(c){
        if(!repliesByParent[c.parentId])repliesByParent[c.parentId]=[];
        repliesByParent[c.parentId].push(c);
    });
    var tabsHtml='<div class="search-tabs" style="margin-bottom:12px;">';
    tabsHtml+='<button class="search-tab comment-sort-tab'+(sortMode==='top'?' active':'')+'" data-sort="top">Top Comments</button>';
    tabsHtml+='<button class="search-tab comment-sort-tab'+(sortMode==='newest'?' active':'')+'" data-sort="newest">Newest</button>';
    tabsHtml+='<button class="search-tab comment-sort-tab'+(sortMode==='oldest'?' active':'')+'" data-sort="oldest">Oldest</button>';
    tabsHtml+='</div>';
    var html='<div class="modal-header"><h3>Comments</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">'+tabsHtml+'<div id="commentsList">';
    if(!topLevel.length) html+='<p style="color:#777;margin-bottom:12px;" id="noCommentsMsg">No comments yet.</p>';
    topLevel.forEach(function(c){
        html+=buildCommentHtml(c.cid,c.name,c.img,c.text,c.likes,false);
        var replies=repliesByParent[c.cid]||[];
        var visibleReplies=replies.slice(0,2);
        visibleReplies.forEach(function(r){html+=buildCommentHtml(r.cid,r.name,r.img,r.text,r.likes,true);});
        if(replies.length>2) html+='<a href="#" class="view-more-replies" data-parent="'+c.cid+'" style="font-size:12px;color:var(--primary);margin-left:42px;display:block;margin-bottom:8px;">View more replies ('+replies.length+')</a>';
    });
    html+='</div><div style="display:flex;gap:10px;margin-top:12px;"><input type="text" class="post-input" id="commentInput" placeholder="Write a comment..." style="flex:1;"><button class="btn btn-primary" id="postCommentBtn">Post</button></div><div id="replyIndicator" style="display:none;font-size:12px;color:var(--primary);margin-top:4px;">Replying to <span id="replyToName"></span> <button id="cancelReply" style="background:none;color:#999;font-size:12px;margin-left:8px;cursor:pointer;">Cancel</button></div></div>';
    showModal(html);
    bindCommentLikes();
    var replyTarget=null;
    // Tab click handlers
    $$('.comment-sort-tab').forEach(function(tab){
        tab.addEventListener('click',function(){showComments(postId,countEl,tab.dataset.sort);});
    });
    // Bind reply buttons helper
    function bindReplyBtns(){
        $$('.comment-reply-btn').forEach(function(btn){
            if(btn._bound)return;btn._bound=true;
            btn.addEventListener('click',function(){
                var cid=btn.dataset.cid;
                replyTarget=cid;
                var item=btn.closest('.comment-item');
                var name=item?item.querySelector('strong').textContent:'';
                document.getElementById('replyIndicator').style.display='block';
                document.getElementById('replyToName').textContent=name;
                document.getElementById('commentInput').placeholder='Reply to '+name+'...';
                document.getElementById('commentInput').focus();
            });
        });
    }
    // View more replies — expand inline
    $$('.view-more-replies').forEach(function(link){
        link.addEventListener('click',function(e){
            e.preventDefault();
            var parentCid=link.dataset.parent;
            var replies=repliesByParent[parentCid]||[];
            var extraHtml='';
            replies.slice(2).forEach(function(r){extraHtml+=buildCommentHtml(r.cid,r.name,r.img,r.text,r.likes,true);});
            link.insertAdjacentHTML('beforebegin',extraHtml);
            link.remove();
            bindCommentLikes();
            bindReplyBtns();
        });
    });
    bindReplyBtns();
    document.getElementById('cancelReply').addEventListener('click',function(){
        replyTarget=null;
        document.getElementById('replyIndicator').style.display='none';
        document.getElementById('commentInput').placeholder='Write a comment...';
    });
    document.getElementById('postCommentBtn').addEventListener('click', async function(){
        var input=document.getElementById('commentInput');var text=input.value.trim();if(!text)return;

        if(isUUID && currentUser) {
            try {
                var parentCid = replyTarget && /^[0-9a-f]{8}-/.test(replyTarget) ? replyTarget : null;
                await sbCreateComment(postId, currentUser.id, text, parentCid);
            } catch(e) { console.error('Comment error:', e); showToast('Comment failed: '+(e.message||'Unknown error')); return; }
        } else {
            if(!state.comments[postId])state.comments[postId]=[];
            state.comments[postId].push(text);
        }

        if(replyTarget){
            if(!state.replyCoinPosts[postId]){state.replyCoinPosts[postId]=true;state.coins+=2;updateCoins();}
            replyTarget=null;
            document.getElementById('replyIndicator').style.display='none';
            input.placeholder='Write a comment...';
        }else{
            if(!state.commentCoinPosts[postId]){state.commentCoinPosts[postId]=true;state.coins+=2;updateCoins();}
        }
        input.value='';if(countEl)countEl.textContent=parseInt(countEl.textContent)+1;
        renderInlineComments(postId);
        showComments(postId,countEl,sortMode);
    });
    document.getElementById('commentInput').addEventListener('keypress',function(e){if(e.key==='Enter')document.getElementById('postCommentBtn').click();});
}

function bindCommentLikes(){
    $$('.comment-like-btn').forEach(function(btn){
        btn.onclick=function(){
            var cid=btn.dataset.cid;var span=btn.querySelector('span');var ct=parseInt(span.textContent);
            var disBtn=btn.closest('.comment-actions-row')?btn.closest('.comment-actions-row').querySelector('.comment-dislike-btn'):btn.parentNode.querySelector('.comment-dislike-btn');
            if(likedComments[cid]){delete likedComments[cid];ct--;btn.style.color='#999';btn.querySelector('i').className='far fa-thumbs-up';}
            else{
                if(dislikedComments[cid]&&disBtn){delete dislikedComments[cid];var ds=disBtn.querySelector('span');ds.textContent=parseInt(ds.textContent)-1;disBtn.style.color='#999';disBtn.querySelector('i').className='far fa-thumbs-down';}
                likedComments[cid]=true;ct++;btn.style.color='var(--primary)';btn.querySelector('i').className='fas fa-thumbs-up';
                var isOwn=cid.indexOf('-u-')!==-1||cid.indexOf('-r-')!==-1;
                if(!isOwn&&!commentCoinAwarded[cid]){commentCoinAwarded[cid]=true;state.coins+=1;updateCoins();}
            }
            span.textContent=ct;
        };
    });
    $$('.comment-dislike-btn').forEach(function(btn){
        btn.onclick=function(){
            var cid=btn.dataset.cid;var span=btn.querySelector('span');var ct=parseInt(span.textContent);
            var likeBtn=btn.closest('.comment-actions-row')?btn.closest('.comment-actions-row').querySelector('.comment-like-btn'):btn.parentNode.querySelector('.comment-like-btn');
            if(dislikedComments[cid]){delete dislikedComments[cid];ct--;btn.style.color='#999';btn.querySelector('i').className='far fa-thumbs-down';}
            else{
                if(likedComments[cid]&&likeBtn){delete likedComments[cid];var ls=likeBtn.querySelector('span');ls.textContent=parseInt(ls.textContent)-1;likeBtn.style.color='#999';likeBtn.querySelector('i').className='far fa-thumbs-up';}
                dislikedComments[cid]=true;ct++;btn.style.color='var(--primary)';btn.querySelector('i').className='fas fa-thumbs-down';
                var isOwn=cid.indexOf('-u-')!==-1||cid.indexOf('-r-')!==-1;
                if(!isOwn&&!commentCoinAwarded[cid]){commentCoinAwarded[cid]=true;state.coins+=1;updateCoins();}
            }
            span.textContent=ct;
        };
    });
}

async function renderInlineComments(postId){
    var el=document.querySelector('.post-comments[data-post-id="'+postId+'"]');
    if(!el)return;
    var all=[];
    var isUUID=/^[0-9a-f]{8}-/.test(postId);
    if(isUUID){
        try{
            var sbComments=await sbGetCommentsLite(postId,20);
            sbComments.forEach(function(c){
                var authorName=(c.author?c.author.display_name||c.author.username:'User');
                var authorAvatar=(c.author?c.author.avatar_url:null);
                var isReply=!!c.parent_comment_id;
                all.push({name:authorName,img:authorAvatar,text:c.content,likes:0,cid:c.id,isReply:isReply});
            });
        }catch(e){
            console.error('Inline comments error for post '+postId+':',e);
            el.innerHTML='<p style="color:#e74c3c;font-size:11px;padding:4px 20px;">Comments failed: '+(e.message||'Unknown error')+'</p>';
            return;
        }
    } else {
        var user=state.comments[postId]||[];
        var _myN=currentUser?(currentUser.display_name||currentUser.username):'You';
        user.forEach(function(t,i){all.push({name:_myN,img:null,text:t,likes:0,cid:postId+'-u-'+i});});
    }
    if(!all.length){el.innerHTML='';el.style.padding='';return;}
    var shown=all.slice(0,5);
    var html='';
    shown.forEach(function(c){
        var liked=likedComments[c.cid];var lc=c.likes+(liked?1:0);
        var disliked=dislikedComments[c.cid];var dc=disliked?1:0;
        var avatarSrc=c.img||DEFAULT_AVATAR;
        var indent=c.isReply?'margin-left:28px;':'';
        var replyIcon=c.isReply?'<i class="fas fa-reply" style="font-size:9px;color:#999;margin-right:4px;transform:scaleX(-1);"></i>':'';
        html+='<div class="inline-comment" style="'+indent+'"><img src="'+avatarSrc+'" class="inline-comment-avatar" style="object-fit:cover;"><div><div class="inline-comment-bubble">'+replyIcon+'<strong style="font-size:12px;">'+c.name+'</strong> <span style="font-size:12px;color:#555;">'+c.text+'</span></div><div style="display:flex;gap:8px;margin-top:2px;margin-left:4px;"><button class="inline-comment-like" data-cid="'+c.cid+'" style="background:none;font-size:11px;color:'+(liked?'var(--primary)':'#999')+';display:flex;align-items:center;gap:3px;"><i class="'+(liked?'fas':'far')+' fa-thumbs-up"></i>'+lc+'</button><button class="inline-comment-dislike" data-cid="'+c.cid+'" style="background:none;font-size:11px;color:'+(disliked?'var(--primary)':'#999')+';display:flex;align-items:center;gap:3px;"><i class="'+(disliked?'fas':'far')+' fa-thumbs-down"></i>'+dc+'</button><button class="inline-comment-reply" data-cid="'+c.cid+'" style="background:none;font-size:11px;color:#999;cursor:pointer;"><i class="far fa-comment"></i> Reply</button></div></div></div>';
    });
    if(all.length>5) html+='<a href="#" class="show-more-comments" style="font-size:12px;color:var(--primary);display:block;margin-top:4px;">See all comments ('+all.length+')</a>';
    el.style.padding='0 20px 14px';el.innerHTML=html;
    el.querySelectorAll('.inline-comment-like').forEach(function(btn){
        btn.onclick=function(e){
            e.stopPropagation();var cid=btn.dataset.cid;var liked=likedComments[cid];
            var base=parseInt(btn.querySelector('span')?btn.querySelector('span').textContent:btn.lastChild.textContent)||0;
            var disBtn=btn.parentNode.querySelector('.inline-comment-dislike');
            if(liked){delete likedComments[cid];btn.style.color='#999';btn.querySelector('i').className='far fa-thumbs-up';btn.lastChild.textContent=Math.max(0,base-1);}
            else{
                if(dislikedComments[cid]&&disBtn){delete dislikedComments[cid];disBtn.style.color='#999';disBtn.querySelector('i').className='far fa-thumbs-down';disBtn.lastChild.textContent=0;}
                likedComments[cid]=true;btn.style.color='var(--primary)';btn.querySelector('i').className='fas fa-thumbs-up';btn.lastChild.textContent=base+1;
                if(!commentCoinAwarded[cid]){commentCoinAwarded[cid]=true;state.coins+=1;updateCoins();}
                // Like comment in Supabase
                if(/^[0-9a-f]{8}-/.test(cid)&&currentUser){sbToggleLike(currentUser.id,'comment',cid).catch(function(){});}
            }
        };
    });
    el.querySelectorAll('.inline-comment-dislike').forEach(function(btn){
        btn.onclick=function(e){
            e.stopPropagation();var cid=btn.dataset.cid;var disliked=dislikedComments[cid];
            var likeBtn=btn.parentNode.querySelector('.inline-comment-like');
            if(disliked){delete dislikedComments[cid];btn.style.color='#999';btn.querySelector('i').className='far fa-thumbs-down';btn.lastChild.textContent=0;}
            else{
                if(likedComments[cid]&&likeBtn){delete likedComments[cid];likeBtn.style.color='#999';likeBtn.querySelector('i').className='far fa-thumbs-up';var lv=parseInt(likeBtn.lastChild.textContent)||0;likeBtn.lastChild.textContent=Math.max(0,lv-1);}
                dislikedComments[cid]=true;btn.style.color='var(--primary)';btn.querySelector('i').className='fas fa-thumbs-down';btn.lastChild.textContent=1;
                if(!commentCoinAwarded[cid]){commentCoinAwarded[cid]=true;state.coins+=1;updateCoins();}
            }
        };
    });
    el.querySelectorAll('.inline-comment-reply').forEach(function(btn){
        btn.onclick=function(e){
            e.stopPropagation();
            showComments(postId,el.closest('.feed-post').querySelector('.comment-btn span'));
            setTimeout(function(){
                var rb=document.querySelector('.comment-reply-btn[data-cid="'+btn.dataset.cid+'"]');
                if(rb)rb.click();
            },100);
        };
    });
    var link=el.querySelector('.show-more-comments');
    if(link)link.addEventListener('click',function(e){e.preventDefault();showComments(postId,el.closest('.feed-post').querySelector('.comment-btn span'));});
}

async function showProfileModal(person){
    var name=person.display_name||person.name||person.username||'User';
    var bio=person.bio||'';
    var avatar=person.avatar_url||DEFAULT_AVATAR;
    var isFollowed=state.followedUsers[person.id];
    var following=0,followers=0;
    try{var fc=await sbGetFollowCounts(person.id);following=fc.following;followers=fc.followers;}catch(e){}
    var html='<div class="modal-header"><h3>Profile</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body"><div class="modal-profile-top"><img src="'+avatar+'" alt="'+name+'"><h3>'+name+'</h3><p>'+bio+'</p></div>';
    html+='<div class="modal-profile-stats"><div class="stat"><span class="stat-count">'+following+'</span><span class="stat-label">Following</span></div><div class="stat"><span class="stat-count">'+followers+'</span><span class="stat-label">Followers</span></div></div>';
    html+='<div class="modal-actions"><button class="btn '+(isFollowed?'btn-disabled':'btn-green')+'" id="modalFollowBtn" data-uid="'+person.id+'">'+(isFollowed?'<i class="fas fa-check"></i> Following':'<i class="fas fa-plus"></i> Follow')+'</button>';
    html+='<button class="btn btn-primary" id="modalMsgBtn" data-uid="'+person.id+'"><i class="fas fa-envelope"></i> Message</button>';
    html+='<button class="btn btn-outline" id="modalViewProfileBtn"><i class="fas fa-user"></i> View Profile</button>';
    html+='<button class="btn btn-outline" id="modalBlockBtn" data-uid="'+person.id+'" style="color:#e74c3c;border-color:#e74c3c;">'+(blockedUsers[person.id]?'<i class="fas fa-unlock"></i> Unblock':'<i class="fas fa-ban"></i> Block')+'</button></div>';
    html+='</div>';
    showModal(html);
    document.getElementById('modalFollowBtn').addEventListener('click',function(){
        toggleFollow(person.id,this);
    });
    document.getElementById('modalMsgBtn').addEventListener('click',function(){
        closeModal();startConversation(person.id,person.display_name||person.name||person.username,person.avatar_url);
    });
    document.getElementById('modalViewProfileBtn').addEventListener('click',function(){
        closeModal();
        showProfileView(person);
    });
    document.getElementById('modalBlockBtn').addEventListener('click',function(){
        if(blockedUsers[person.id]){
            unblockUser(person.id);
            closeModal();
            showProfileModal(person);
        } else {
            showBlockConfirmModal(person);
        }
    });
}

function showMyProfileModal(){
    var _mn=currentUser?(currentUser.display_name||currentUser.username):'You';
    var _mb=currentUser?currentUser.bio:'';
    var html='<div class="modal-header"><h3>My Profile</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body"><div class="modal-profile-top"><img src="'+getMyAvatar()+'" alt="'+_mn+'"><h3>'+_mn+'</h3><p>'+_mb+'</p></div>';
    html+='<div class="modal-profile-stats"><div class="stat"><span class="stat-count">'+state.following+'</span><span class="stat-label">Following</span></div><div class="stat"><span class="stat-count">'+state.followers+'</span><span class="stat-label">Followers</span></div></div>';
    html+='<div style="text-align:center;"><p style="color:#777;font-size:13px;">Active Skin: '+(state.activeSkin?skins.find(function(s){return s.id===state.activeSkin;}).name:'Default')+'</p></div>';
    html+='<div class="modal-actions" style="margin-top:16px;"><button class="btn btn-outline" id="modalViewMyProfileBtn"><i class="fas fa-user"></i> View Profile</button></div></div>';
    showModal(html);
    document.getElementById('modalViewMyProfileBtn').addEventListener('click',function(){
        closeModal();
        showProfileView({id:currentUser?currentUser.id:0,name:currentUser?(currentUser.display_name||currentUser.username):'You',status:currentUser?currentUser.status||'':'',bio:currentUser?currentUser.bio||'':'',img:12,avatar_url:currentUser?currentUser.avatar_url:null,isMe:true});
    });
}

// Convert Supabase profile to person object for showProfileView
function profileToPerson(p){
    var sd=p.skin_data||{};
    return {
        id:p.id,
        name:p.display_name||p.username,
        status:p.status||'',
        bio:p.bio||'',
        avatar_url:p.avatar_url,
        premiumSkin:sd.activePremiumSkin||null,
        skin:sd.activeSkin||null,
        font:sd.activeFont||null,
        template:sd.activeTemplate||null,
        premiumBg:sd.premiumBgUrl?{src:sd.premiumBgUrl,saturation:sd.premiumBgSaturation||100}:null
    };
}
// ======================== PROFILE VIEW PAGE ========================
async function showProfileView(person){
    $$('.page').forEach(function(p){p.classList.remove('active');});
    document.getElementById('page-profile-view').classList.add('active');
    $$('.nav-link').forEach(function(l){l.classList.remove('active');});
    _navPrev=_navCurrent;_navCurrent='profile-view';
    window.scrollTo(0,0);

    var isMe=person.isMe||false;
    var isFollowed=state.followedUsers[person.id];
    var following=0, followers=0;
    if(isMe){ following=state.following; followers=state.followers; }
    else { try{ var fc=await sbGetFollowCounts(person.id); following=fc.following; followers=fc.followers; }catch(e){} }

    // Apply viewed person's skin/font/template (silent, don't change state)
    _pvSaved={skin:state.activeSkin,premiumSkin:state.activePremiumSkin,font:state.activeFont,tpl:state.activeTemplate,bgImage:premiumBgImage,bgSat:premiumBgSaturation};
    if(!isMe){
        if(person.premiumSkin){
            applyPremiumSkin(person.premiumSkin,true);
            if(person.premiumBg){premiumBgImage=person.premiumBg.src;premiumBgSaturation=person.premiumBg.saturation||100;}
            else{premiumBgImage=null;premiumBgSaturation=100;}
            // Temporarily set activePremiumSkin so updatePremiumBg shows the bg
            state.activePremiumSkin=person.premiumSkin;
            updatePremiumBg();
        } else {
            premiumBgImage=null;updatePremiumBg();
            applySkin(person.skin||null,true);
        }
        applyFont(person.font||null,true);
        applyTemplate(person.template||null,true);
    }

    // Cover banner
    $('#pvCoverBanner').style.backgroundImage='';

    // Profile card - matches home sidebar style
    var cardHtml='<div class="profile-cover" style="background:linear-gradient(135deg,var(--primary),var(--primary-hover));"></div>';
    cardHtml+='<div class="profile-info">';
    var pvAvatarSrc=person.avatar_url||DEFAULT_AVATAR;
    cardHtml+='<div class="profile-avatar-wrap"><img src="'+pvAvatarSrc+'" alt="'+person.name+'" class="profile-avatar"></div>';
    cardHtml+='<h3 class="profile-name">'+person.name+'</h3>';
    if(person.status) cardHtml+='<p class="profile-title">'+person.status+'</p>';
    if(person.bio) cardHtml+='<p class="profile-about">'+person.bio+'</p>';
    var pvPriv=isMe?state.privateFollowers:!!person.priv;
    cardHtml+='<div class="profile-stats">';
    cardHtml+='<div class="stat stat-clickable pv-stat-following" style="'+(pvPriv?'opacity:.5;pointer-events:none;cursor:default;':'')+'"><span class="stat-count">'+following+'</span><span class="stat-label">Following'+(pvPriv?' <i class="fas fa-lock" style="font-size:10px;"></i>':'')+'</span></div>';
    cardHtml+='<div class="stat stat-clickable pv-stat-followers" style="'+(pvPriv?'opacity:.5;pointer-events:none;cursor:default;':'')+'"><span class="stat-count">'+followers+'</span><span class="stat-label">Followers'+(pvPriv?' <i class="fas fa-lock" style="font-size:10px;"></i>':'')+'</span></div>';
    cardHtml+='</div>';
    if(!isMe){
        cardHtml+='<div class="pv-actions"><button class="btn '+(isFollowed?'btn-disabled':'btn-green')+'" id="pvFollowBtn" data-uid="'+person.id+'">'+(isFollowed?'<i class="fas fa-check"></i> Following':'<i class="fas fa-plus"></i> Follow')+'</button>';
        cardHtml+='<button class="btn btn-primary" id="pvMsgBtn"><i class="fas fa-envelope"></i> Message</button>';
        cardHtml+='<button class="btn btn-outline" id="pvBlockBtn" style="color:#e74c3c;border-color:#e74c3c;">'+(blockedUsers[person.id]?'<i class="fas fa-unlock"></i> Unblock':'<i class="fas fa-ban"></i> Block')+'</button></div>';
    }
    cardHtml+='<div class="profile-links"><a href="#" class="pv-back-link" id="pvBack"><i class="fas fa-arrow-left"></i> Back to Home</a></div>';
    cardHtml+='</div>';
    $('#pvProfileCard').innerHTML=cardHtml;

    // Photos card - spans full width, always has photos
    var photosHtml='<div class="card photos-card"><h4 class="card-heading"><i class="fas fa-images" style="margin-right:8px;color:var(--primary);"></i>Photos</h4>';
    photosHtml+='<div class="photos-preview">';
    if(isMe){
        var allPhotos=getAllPhotos();
        if(allPhotos.length){allPhotos.slice(0,9).forEach(function(p){photosHtml+='<img src="'+p.src+'">';});}
        else{photosHtml+='<p class="photos-empty" style="color:var(--gray);font-size:13px;text-align:center;padding:20px 0;">No photos yet. Upload photos to see them here.</p>';}
    } else {
        photosHtml+='<p class="photos-empty" style="color:var(--gray);font-size:13px;text-align:center;padding:20px 0;">No photos available.</p>';
    }
    photosHtml+='</div>';
    if(isMe) photosHtml+='<a href="#" class="view-more-link pv-photos-link">View All</a>';
    photosHtml+='</div>';
    document.getElementById('pvPhotosCard').innerHTML=photosHtml;
    var pvPP=document.querySelector('#pvPhotosCard .photos-preview');
    if(pvPP&&document.body.classList.contains('tpl-cinema')){pvPP.classList.add('shop-scroll-row');initDragScroll('#pvPhotosCard');}
    var pvPhotosLink=document.querySelector('.pv-photos-link');
    if(pvPhotosLink)pvPhotosLink.addEventListener('click',function(e){e.preventDefault();renderPhotoAlbum();navigateTo('photos');});

    // "What Skin Am I?" box - reads live state for own profile, person data for others
    var pvSkinId=isMe?(state.activePremiumSkin||state.activeSkin):(person.premiumSkin||person.skin);
    var pvFontId=isMe?state.activeFont:person.font;
    var pvTplId=isMe?state.activeTemplate:person.template;
    var pvSkinName=null;
    if(pvSkinId){pvSkinName=skins.find(function(s){return s.id===pvSkinId;})||premiumSkins.find(function(s){return s.id===pvSkinId;});}
    var pvFontName=pvFontId?fonts.find(function(f){return f.id===pvFontId;}):null;
    var pvTplName=pvTplId?templates.find(function(t){return t.id===pvTplId;}):null;
    var skinHtml='<div class="card" style="padding:20px;"><h4 style="font-size:15px;font-weight:600;margin-bottom:14px;"><i class="fas fa-wand-magic-sparkles" style="color:var(--primary);margin-right:8px;"></i>What Skin Am I?</h4>';
    skinHtml+='<div style="display:flex;flex-direction:column;gap:10px;">';
    skinHtml+='<div style="display:flex;align-items:center;gap:10px;font-size:13px;"><i class="fas fa-palette" style="width:16px;color:var(--primary);"></i><span style="color:var(--gray);">Skin:</span><strong>'+(pvSkinName?pvSkinName.name:'Default')+'</strong></div>';
    skinHtml+='<div style="display:flex;align-items:center;gap:10px;font-size:13px;"><i class="fas fa-font" style="width:16px;color:var(--primary);"></i><span style="color:var(--gray);">Font:</span><strong>'+(pvFontName?pvFontName.name:'Default')+'</strong></div>';
    skinHtml+='<div style="display:flex;align-items:center;gap:10px;font-size:13px;"><i class="fas fa-table-columns" style="width:16px;color:var(--primary);"></i><span style="color:var(--gray);">Template:</span><strong>'+(pvTplName?pvTplName.name:'Default')+'</strong></div>';
    skinHtml+='</div></div>';
    document.getElementById('pvSkinCard').innerHTML=skinHtml;

    // Posts feed - load from Supabase
    var feedHtml='';
    var userId=isMe?currentUser.id:person.id;
    try{
        var userPosts=await sbGetUserPosts(userId,10);
        if(!userPosts||!userPosts.length){
            feedHtml+='<div class="card" style="padding:40px;text-align:center;color:var(--gray);"><i class="fas fa-pen" style="font-size:32px;margin-bottom:12px;display:block;"></i><p>No posts yet.</p></div>';
        } else {
            userPosts.forEach(function(post){
                var authorName=person.name||(post.profiles?post.profiles.display_name||post.profiles.username:'User');
                var authorAvatar=(post.profiles?post.profiles.avatar_url:person.avatar_url)||DEFAULT_AVATAR;
                var postTime=post.created_at?timeAgo(Math.floor((Date.now()-new Date(post.created_at).getTime())/60000)):'';
                feedHtml+='<div class="card feed-post">';
                feedHtml+='<div class="post-header">';
                feedHtml+='<img src="'+authorAvatar+'" alt="'+authorName+'" class="post-avatar">';
                feedHtml+='<div class="post-user-info"><div class="post-user-top"><h4 class="post-username">'+authorName+'</h4><span class="post-time">'+postTime+'</span></div></div></div>';
                feedHtml+='<div class="post-description"><p>'+post.content+'</p>';
                if(post.image_url) feedHtml+='<img src="'+post.image_url+'" class="post-image" style="max-width:100%;border-radius:8px;margin-top:8px;">';
                feedHtml+='</div>';
                feedHtml+='<div class="post-actions"><div class="action-left">';
                feedHtml+='<button class="action-btn like-btn" data-post-id="'+post.id+'"><i class="'+(state.likedPosts[post.id]?'fas':'far')+' fa-thumbs-up"></i><span class="like-count">0</span></button>';
                feedHtml+='<button class="action-btn dislike-btn" data-post-id="'+post.id+'"><i class="'+(state.dislikedPosts[post.id]?'fas':'far')+' fa-thumbs-down"></i><span class="dislike-count">0</span></button>';
                feedHtml+='<button class="action-btn comment-btn"><i class="far fa-comment"></i><span>0</span></button>';
                feedHtml+='</div></div>';
                feedHtml+='</div>';
            });
        }
    }catch(e){
        console.error('pvPosts:',e);
        feedHtml+='<div class="card" style="padding:40px;text-align:center;color:var(--gray);"><i class="fas fa-pen" style="font-size:32px;margin-bottom:12px;display:block;"></i><p>No posts yet.</p></div>';
    }
    $('#pvPostsFeed').innerHTML=feedHtml;

    // Event: Back
    document.getElementById('pvBack').addEventListener('click',function(e){e.preventDefault();navigateTo('home');});
    // Event: Follow
    var followBtn=document.getElementById('pvFollowBtn');
    if(followBtn){
        followBtn.addEventListener('click',function(){toggleFollow(person.id,this);});
    }
    // Event: View following/followers lists
    var pvFollowingStat=document.querySelector('.pv-stat-following');
    var pvFollowersStat=document.querySelector('.pv-stat-followers');
    if(pvFollowingStat){
        pvFollowingStat.addEventListener('click',async function(){
            var uid=isMe?currentUser.id:person.id;
            var title=isMe?'Following':person.name+'\'s Following';
            try{var list=await sbGetFollowing(uid);showFollowListModal(title,list,isMe);}catch(e){console.error(e);}
        });
    }
    if(pvFollowersStat){
        pvFollowersStat.addEventListener('click',async function(){
            var uid=isMe?currentUser.id:person.id;
            var title=isMe?'Followers':person.name+'\'s Followers';
            try{var list=await sbGetFollowers(uid);showFollowListModal(title,list,false);}catch(e){console.error(e);}
        });
    }
    // Event: Message
    var msgBtn=document.getElementById('pvMsgBtn');
    if(msgBtn){
        msgBtn.addEventListener('click',function(){
            startConversation(person.id,person.name||person.display_name||person.username,person.avatar_url);
        });
    }
    var blockBtn=document.getElementById('pvBlockBtn');
    if(blockBtn){
        blockBtn.addEventListener('click',function(){
            if(blockedUsers[person.id]){
                unblockUser(person.id);
                showProfileView(person);
            } else {
                showBlockConfirmModal(person,function(){showProfileView(person);});
            }
        });
    }
    // Event: Likes
    $$('#pvPostsFeed .like-btn').forEach(function(btn){
        btn.addEventListener('click',function(e){
            if(e.target.classList.contains('like-count')) return;
            var pid=btn.getAttribute('data-post-id');var countEl=btn.querySelector('.like-count');var count=parseInt(countEl.textContent);
            var had=!!(state.likedPosts[pid]||state.dislikedPosts[pid]);
            if(state.likedPosts[pid]){delete state.likedPosts[pid];btn.classList.remove('liked');btn.querySelector('i').className='far fa-thumbs-up';countEl.textContent=count-1;}
            else{if(state.dislikedPosts[pid]){var db=btn.closest('.action-left').querySelector('.dislike-btn');var dc=db.querySelector('.dislike-count');dc.textContent=parseInt(dc.textContent)-1;delete state.dislikedPosts[pid];db.classList.remove('disliked');db.querySelector('i').className='far fa-thumbs-down';}state.likedPosts[pid]=true;btn.classList.add('liked');btn.querySelector('i').className='fas fa-thumbs-up';countEl.textContent=count+1;}
            var has=!!(state.likedPosts[pid]||state.dislikedPosts[pid]);if(!had&&has){state.coins++;updateCoins();}else if(had&&!has){state.coins--;updateCoins();}
        });
    });
    $$('#pvPostsFeed .dislike-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            var pid=btn.getAttribute('data-post-id');var countEl=btn.querySelector('.dislike-count');var count=parseInt(countEl.textContent);
            var had=!!(state.likedPosts[pid]||state.dislikedPosts[pid]);
            if(state.dislikedPosts[pid]){delete state.dislikedPosts[pid];btn.classList.remove('disliked');btn.querySelector('i').className='far fa-thumbs-down';countEl.textContent=count-1;}
            else{if(state.likedPosts[pid]){var lb=btn.closest('.action-left').querySelector('.like-btn');var lc=lb.querySelector('.like-count');lc.textContent=parseInt(lc.textContent)-1;delete state.likedPosts[pid];lb.classList.remove('liked');lb.querySelector('i').className='far fa-thumbs-up';}state.dislikedPosts[pid]=true;btn.classList.add('disliked');btn.querySelector('i').className='fas fa-thumbs-down';countEl.textContent=count+1;}
            var has=!!(state.likedPosts[pid]||state.dislikedPosts[pid]);if(!had&&has){state.coins++;updateCoins();}else if(had&&!has){state.coins--;updateCoins();}
        });
    });
    // Event: Comments
    $$('#pvPostsFeed .comment-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            var postId=btn.closest('.action-left').querySelector('.like-btn').getAttribute('data-post-id');
            showComments(postId,btn.querySelector('span'));
        });
    });
    // Event: Share
    $$('#pvPostsFeed .share-btn').forEach(function(btn){btn.addEventListener('click',function(){handleShare(btn);});});
    bindLikeCountClicks('#pvPostsFeed');
}

function showGroupModal(group){
    var joined=state.joinedGroups[group.id];
    var html='<div class="modal-header"><h3>'+group.name+'</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body"><div style="text-align:center;margin-bottom:20px;"><div style="width:64px;height:64px;border-radius:16px;background:'+group.color+';color:#fff;font-size:28px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;"><i class="fas '+group.icon+'"></i></div>';
    html+='<h3 style="font-size:18px;font-weight:600;margin-bottom:4px;">'+group.name+'</h3><p style="color:#777;font-size:14px;margin-bottom:8px;">'+group.desc+'</p>';
    html+='<span class="group-members"><i class="fas fa-users"></i> '+fmtNum(group.members)+' members</span></div>';
    html+='<div class="modal-actions"><button class="btn '+(joined?'btn-disabled':'btn-primary')+'" id="modalJoinBtn" data-gid="'+group.id+'">'+(joined?'Joined':'Join Group')+'</button></div></div>';
    showModal(html);
    document.getElementById('modalJoinBtn').addEventListener('click',async function(){
        if(!state.joinedGroups[group.id]&&currentUser){
            try{
                await sbJoinGroup(group.id,currentUser.id);
                state.joinedGroups[group.id]=true;
                group.members++;
                saveState();
                this.textContent='Joined';
                this.classList.remove('btn-primary');
                this.classList.add('btn-disabled');
                addNotification('group','You joined the group "'+group.name+'"');
            }catch(e2){console.error('Join group:',e2);showToast('Failed to join group');}
        }
    });
}

function getGroupThemeColor(group){
    var premSkin=state.groupActivePremiumSkin[group.id];
    var basicSkin=state.groupActiveSkin[group.id];
    if(premSkin){var ps=premiumSkins.find(function(s){return s.id===premSkin;});if(ps)return ps.accent;}
    if(basicSkin){if(skinColors[basicSkin])return skinColors[basicSkin].primary;var gs=guildSkins.find(function(s){return s.id===basicSkin;});if(gs)return gs.cardText;}
    return group.color||'var(--primary)';
}
function showGroupProfileCropModal(src,group){
    var html='<div class="modal-header"><h3>Crop Group Photo</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body" style="text-align:center;"><div class="crop-container" id="cropContainer"><img src="'+src+'" id="cropImg"><div class="crop-box" id="cropBox"><div class="crop-resize" id="cropResize"></div></div></div>';
    html+='<div style="margin-top:16px;"><button class="btn btn-primary" id="cropConfirmBtn">Apply</button></div></div>';
    showModal(html);
    var img=document.getElementById('cropImg');var box=document.getElementById('cropBox');var resizeHandle=document.getElementById('cropResize');
    function gpInitCrop(){var size=Math.min(img.clientWidth,img.clientHeight,200);if(size<10){setTimeout(gpInitCrop,50);return;}box.style.width=size+'px';box.style.height=size+'px';box.style.left=((img.clientWidth-size)/2)+'px';box.style.top=((img.clientHeight-size)/2)+'px';}
    if(img.complete&&img.naturalWidth>0) setTimeout(gpInitCrop,50); else img.onload=function(){setTimeout(gpInitCrop,50);};
    var dragging=false,resizing=false,startX,startY,startL,startT,startW,startH;
    function gpDragStart(x,y,isResize){if(isResize){resizing=true;startW=box.offsetWidth;startH=box.offsetHeight;}else{dragging=true;startL=box.offsetLeft;startT=box.offsetTop;}startX=x;startY=y;}
    function gpDragMove(x,y){if(dragging){box.style.left=Math.max(0,Math.min(startL+(x-startX),img.clientWidth-box.offsetWidth))+'px';box.style.top=Math.max(0,Math.min(startT+(y-startY),img.clientHeight-box.offsetHeight))+'px';}if(resizing){var d=Math.max(x-startX,y-startY);var ns=Math.max(40,Math.min(startW+d,img.clientWidth-box.offsetLeft,img.clientHeight-box.offsetTop));box.style.width=ns+'px';box.style.height=ns+'px';}}
    function gpDragEnd(){dragging=false;resizing=false;}
    box.addEventListener('mousedown',function(e){if(e.target===resizeHandle)return;gpDragStart(e.clientX,e.clientY,false);e.preventDefault();});
    resizeHandle.addEventListener('mousedown',function(e){gpDragStart(e.clientX,e.clientY,true);e.preventDefault();e.stopPropagation();});
    document.addEventListener('mousemove',function onGpMove(e){gpDragMove(e.clientX,e.clientY);});
    document.addEventListener('mouseup',gpDragEnd);
    box.addEventListener('touchstart',function(e){if(e.target===resizeHandle)return;var t=e.touches[0];gpDragStart(t.clientX,t.clientY,false);e.preventDefault();},{passive:false});
    resizeHandle.addEventListener('touchstart',function(e){var t=e.touches[0];gpDragStart(t.clientX,t.clientY,true);e.preventDefault();e.stopPropagation();},{passive:false});
    document.addEventListener('touchmove',function(e){if(dragging||resizing){var t=e.touches[0];gpDragMove(t.clientX,t.clientY);e.preventDefault();}},{passive:false});
    document.addEventListener('touchend',gpDragEnd);
    document.getElementById('cropConfirmBtn').addEventListener('click',function(){
        var canvas=document.createElement('canvas');var scaleX=img.naturalWidth/img.clientWidth;var scaleY=img.naturalHeight/img.clientHeight;
        var sx=box.offsetLeft*scaleX,sy=box.offsetTop*scaleY,sw=box.offsetWidth*scaleX,sh=box.offsetHeight*scaleY;
        canvas.width=400;canvas.height=400;var ctx=canvas.getContext('2d');ctx.drawImage(img,sx,sy,sw,sh,0,0,400,400);
        var url=canvas.toDataURL('image/png');
        group.profileImg=url;
        if(!group.photos) group.photos={profile:[],cover:[]};
        group.photos.profile.unshift({src:url,date:Date.now()});
        closeModal();showGroupView(group);renderGroups();
    });
}
function showGroupCoverCropModal(src,group,banner){
    var html='<div class="modal-header"><h3>Crop Cover Photo</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body" style="text-align:center;"><p style="font-size:13px;color:var(--gray);margin-bottom:12px;">Drag to position. Resize the selection area.</p><div class="crop-container" id="coverCropContainer" style="position:relative;display:inline-block;max-width:100%;overflow:hidden;"><img src="'+src+'" id="coverCropImg" style="max-width:100%;display:block;"><div id="coverCropBox" style="position:absolute;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.5);cursor:move;"><div id="coverCropResize" style="position:absolute;bottom:-4px;right:-4px;width:12px;height:12px;background:#fff;border:1px solid #333;cursor:nwse-resize;"></div></div></div>';
    html+='<div style="margin-top:16px;"><button class="btn btn-primary" id="coverCropConfirmBtn">Apply</button></div></div>';
    showModal(html);
    var img=document.getElementById('coverCropImg');var box=document.getElementById('coverCropBox');var resizeHandle=document.getElementById('coverCropResize');
    var aspectRatio=1280/350;
    function gcInitCrop(){var w=Math.min(img.clientWidth,img.clientWidth*0.9);if(w<10){setTimeout(gcInitCrop,50);return;}var h=Math.round(w/aspectRatio);if(h>img.clientHeight*0.9){h=Math.round(img.clientHeight*0.9);w=Math.round(h*aspectRatio);}box.style.width=w+'px';box.style.height=h+'px';box.style.left=((img.clientWidth-w)/2)+'px';box.style.top=((img.clientHeight-h)/2)+'px';}
    if(img.complete&&img.naturalWidth>0) setTimeout(gcInitCrop,50); else img.onload=function(){setTimeout(gcInitCrop,50);};
    var dragging=false,resizing=false,startX,startY,startL,startT,startW,startH;
    function gcDragStart(x,y,isResize){if(isResize){resizing=true;startW=box.offsetWidth;startH=box.offsetHeight;}else{dragging=true;startL=box.offsetLeft;startT=box.offsetTop;}startX=x;startY=y;}
    function gcDragMove(x,y){if(dragging){box.style.left=Math.max(0,Math.min(startL+(x-startX),img.clientWidth-box.offsetWidth))+'px';box.style.top=Math.max(0,Math.min(startT+(y-startY),img.clientHeight-box.offsetHeight))+'px';}if(resizing){var nw=Math.max(100,Math.min(startW+(x-startX),img.clientWidth-box.offsetLeft));var nh=Math.round(nw/aspectRatio);if(nh>img.clientHeight-box.offsetTop){nh=img.clientHeight-box.offsetTop;nw=Math.round(nh*aspectRatio);}box.style.width=nw+'px';box.style.height=nh+'px';}}
    function gcDragEnd(){dragging=false;resizing=false;}
    box.addEventListener('mousedown',function(e){if(e.target===resizeHandle)return;gcDragStart(e.clientX,e.clientY,false);e.preventDefault();});
    resizeHandle.addEventListener('mousedown',function(e){gcDragStart(e.clientX,e.clientY,true);e.preventDefault();e.stopPropagation();});
    document.addEventListener('mousemove',function onGcMove(e){gcDragMove(e.clientX,e.clientY);});
    document.addEventListener('mouseup',gcDragEnd);
    box.addEventListener('touchstart',function(e){if(e.target===resizeHandle)return;var t=e.touches[0];gcDragStart(t.clientX,t.clientY,false);e.preventDefault();},{passive:false});
    resizeHandle.addEventListener('touchstart',function(e){var t=e.touches[0];gcDragStart(t.clientX,t.clientY,true);e.preventDefault();e.stopPropagation();},{passive:false});
    document.addEventListener('touchmove',function(e){if(dragging||resizing){var t=e.touches[0];gcDragMove(t.clientX,t.clientY);e.preventDefault();}},{passive:false});
    document.addEventListener('touchend',gcDragEnd);
    document.getElementById('coverCropConfirmBtn').addEventListener('click',function(){
        var canvas=document.createElement('canvas');var scaleX=img.naturalWidth/img.clientWidth;var scaleY=img.naturalHeight/img.clientHeight;
        var sx=box.offsetLeft*scaleX,sy=box.offsetTop*scaleY,sw=box.offsetWidth*scaleX,sh=box.offsetHeight*scaleY;
        canvas.width=1280;canvas.height=350;var ctx=canvas.getContext('2d');ctx.drawImage(img,sx,sy,sw,sh,0,0,1280,350);
        var url=canvas.toDataURL('image/jpeg',0.9);
        group.coverPhoto=url;
        if(!group.photos) group.photos={profile:[],cover:[]};
        group.photos.cover.unshift({src:url,date:Date.now()});
        banner.style.background='url('+url+') center/cover';
        closeModal();
    });
}
async function showGroupProfileModal(person,group){
    var personName=person.display_name||person.name||person.username||'User';
    var personBio=person.bio||'';
    var personAvatar=person.avatar_url||DEFAULT_AVATAR;
    var isFollowed=state.followedUsers[person.id];
    var myRole=getMyGroupRole(group);
    var myRank=roleRank(myRole);
    var theirRole=getPersonGroupRole(person,group);
    var theirRank=roleRank(theirRole);
    var gc=getGroupThemeColor(group);
    var following=0,followers=0;
    try{var fc=await sbGetFollowCounts(person.id);following=fc.following;followers=fc.followers;}catch(e){}
    var html='<div class="modal-header"><h3>Profile</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body" style="padding:16px;">';
    html+='<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">';
    html+='<img src="'+personAvatar+'" alt="'+personName+'" style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex-shrink:0;">';
    html+='<div><h3 style="font-size:16px;font-weight:600;margin:0;">'+personName+'</h3><p style="font-size:13px;color:var(--gray);margin:2px 0 0;">'+personBio+'</p>';
    if(theirRole!=='Member') html+='<span style="font-size:10px;background:'+(theirRole==='Admin'?'#e74c3c':gc)+';color:#fff;padding:1px 7px;border-radius:8px;display:inline-block;margin-top:3px;">'+theirRole+'</span>';
    html+='</div></div>';
    html+='<div style="display:flex;justify-content:center;gap:24px;padding:10px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:12px;"><div class="stat"><span class="stat-count" style="font-size:15px;color:'+gc+';">'+following+'</span><span class="stat-label" style="font-size:11px;">Following</span></div><div class="stat"><span class="stat-count" style="font-size:15px;color:'+gc+';">'+followers+'</span><span class="stat-label" style="font-size:11px;">Followers</span></div></div>';
    html+='<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">';
    html+='<button class="btn '+(isFollowed?'btn-disabled':'btn-green')+'" id="modalFollowBtn" data-uid="'+person.id+'" style="font-size:12px;padding:6px 12px;">'+(isFollowed?'<i class="fas fa-check"></i> Following':'<i class="fas fa-plus"></i> Follow')+'</button>';
    html+='<button class="btn btn-primary" id="modalMsgBtn" data-uid="'+person.id+'" style="font-size:12px;padding:6px 12px;background:'+gc+';border-color:'+gc+';"><i class="fas fa-envelope"></i> Message</button>';
    html+='<button class="btn btn-outline" id="modalViewProfileBtn" style="font-size:12px;padding:6px 12px;"><i class="fas fa-user"></i> View Profile</button>';
    // Role management buttons
    if(myRole==='Admin'){
        if(theirRole==='Member'){
            html+='<button class="btn btn-outline" id="grpSetMod" style="font-size:12px;padding:6px 12px;color:'+gc+';border-color:'+gc+';"><i class="fas fa-shield-halved"></i> Make Mod</button>';
            html+='<button class="btn btn-outline" id="grpSetCoAdmin" style="font-size:12px;padding:6px 12px;color:'+gc+';border-color:'+gc+';"><i class="fas fa-shield"></i> Co-Admin</button>';
        } else if(theirRole==='Moderator'){
            html+='<button class="btn btn-outline" id="grpSetCoAdmin" style="font-size:12px;padding:6px 12px;color:'+gc+';border-color:'+gc+';"><i class="fas fa-shield"></i> Promote</button>';
            html+='<button class="btn btn-outline" id="grpRemoveRole" style="font-size:12px;padding:6px 12px;color:#e74c3c;border-color:#e74c3c;"><i class="fas fa-shield-halved"></i> Remove Mod</button>';
        } else if(theirRole==='Co-Admin'){
            html+='<button class="btn btn-outline" id="grpRemoveRole" style="font-size:12px;padding:6px 12px;color:#e74c3c;border-color:#e74c3c;"><i class="fas fa-shield"></i> Demote</button>';
        }
        if(theirRole==='Co-Admin'||theirRole==='Moderator'){
            html+='<button class="btn btn-outline" id="grpTransferOwn" style="font-size:12px;padding:6px 12px;color:#f59e0b;border-color:#f59e0b;"><i class="fas fa-crown"></i> Transfer</button>';
        }
    } else if(myRole==='Co-Admin'){
        if(theirRole==='Member') html+='<button class="btn btn-outline" id="grpSetMod" style="font-size:12px;padding:6px 12px;color:'+gc+';border-color:'+gc+';"><i class="fas fa-shield-halved"></i> Make Mod</button>';
        if(theirRole==='Moderator') html+='<button class="btn btn-outline" id="grpRemoveRole" style="font-size:12px;padding:6px 12px;color:#e74c3c;border-color:#e74c3c;"><i class="fas fa-shield-halved"></i> Remove Mod</button>';
    }
    html+='</div></div>';
    showModal(html);
    document.getElementById('modalFollowBtn').addEventListener('click',function(){toggleFollow(person.id,this);});
    document.getElementById('modalMsgBtn').addEventListener('click',function(){
        closeModal();startConversation(person.id,person.display_name||person.name||person.username,person.avatar_url);
    });
    document.getElementById('modalViewProfileBtn').addEventListener('click',function(){closeModal();showProfileView(person);});
    var setModBtn=document.getElementById('grpSetMod');
    if(setModBtn){setModBtn.addEventListener('click',function(){
        group.mods.push({name:person.name,img:person.img,role:'Moderator'});
        addNotification('group','You made '+person.name+' a Moderator of "'+group.name+'"');
        closeModal();showGroupView(group);
    });}
    var setCoAdminBtn=document.getElementById('grpSetCoAdmin');
    if(setCoAdminBtn){setCoAdminBtn.addEventListener('click',function(){
        group.mods=group.mods.filter(function(m){return m.name!==person.name;});
        group.mods.unshift({name:person.name,img:person.img,role:'Co-Admin'});
        addNotification('group','You made '+person.name+' a Co-Admin of "'+group.name+'"');
        closeModal();showGroupView(group);
    });}
    var removeRoleBtn=document.getElementById('grpRemoveRole');
    if(removeRoleBtn){removeRoleBtn.addEventListener('click',function(){
        group.mods=group.mods.filter(function(m){return m.name!==person.name;});
        addNotification('group','You removed '+person.name+'\'s role in "'+group.name+'"');
        closeModal();showGroupView(group);
    });}
    var transferBtn=document.getElementById('grpTransferOwn');
    if(transferBtn){transferBtn.addEventListener('click',function(){
        showTransferOwnershipModal(person,group);
    });}
}

function showTransferOwnershipModal(person,group){
    var h='<div class="modal-header"><h3>Transfer Ownership</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
    h+='<p style="text-align:center;margin-bottom:4px;">Transfer ownership of <strong>'+group.name+'</strong> to <strong>'+person.name+'</strong>?</p>';
    h+='<p style="text-align:center;color:#e74c3c;font-size:13px;margin-bottom:16px;">You will be demoted to Co-Admin.</p>';
    h+='<label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Type the exact group name to confirm:</label>';
    h+='<input type="text" class="post-input" id="transferConfirmInput" placeholder="'+group.name+'" style="width:100%;margin-bottom:16px;">';
    h+='<div class="modal-actions"><button class="btn btn-outline" id="transferCancel">Cancel</button><button class="btn btn-primary" id="transferConfirm" disabled style="background:#f59e0b;border-color:#f59e0b;opacity:.5;"><i class="fas fa-crown"></i> Transfer</button></div></div>';
    showModal(h);
    var inp=document.getElementById('transferConfirmInput'),btn=document.getElementById('transferConfirm');
    inp.addEventListener('input',function(){var match=inp.value===group.name;btn.disabled=!match;btn.style.opacity=match?'1':'.5';});
    document.getElementById('transferCancel').addEventListener('click',closeModal);
    btn.addEventListener('click',function(){
        if(inp.value!==group.name)return;
        // Remove person from mods, make them admin
        group.mods=group.mods.filter(function(m){return m.name!==person.name;});
        // Add me as Co-Admin
        var myName=currentUser?(currentUser.display_name||currentUser.username):'Me';
        group.mods.unshift({name:myName,role:'Co-Admin'});
        // Transfer ownership
        group.createdBy=person.name;
        group.adminName=person.name;group.adminImg=person.img;
        addNotification('group','You transferred ownership of "'+group.name+'" to '+person.name);
        closeModal();showGroupView(group);
    });
}

function showDeleteGroupModal(group){
    var h='<div class="modal-header"><h3>Delete Group</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
    h+='<p style="text-align:center;color:#e74c3c;font-weight:600;margin-bottom:8px;"><i class="fas fa-triangle-exclamation"></i> This action cannot be undone.</p>';
    h+='<p style="text-align:center;margin-bottom:16px;">All posts, members, and data will be permanently deleted.</p>';
    h+='<label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Type the exact group name to confirm:</label>';
    h+='<input type="text" class="post-input" id="deleteConfirmInput" placeholder="'+group.name+'" style="width:100%;margin-bottom:16px;">';
    h+='<div class="modal-actions"><button class="btn btn-outline" id="deleteCancel">Cancel</button><button class="btn btn-primary" id="deleteConfirm" disabled style="background:#e74c3c;border-color:#e74c3c;opacity:.5;">Delete Group</button></div></div>';
    showModal(h);
    var inp=document.getElementById('deleteConfirmInput'),btn=document.getElementById('deleteConfirm');
    inp.addEventListener('input',function(){var match=inp.value===group.name;btn.disabled=!match;btn.style.opacity=match?'1':'.5';});
    document.getElementById('deleteCancel').addEventListener('click',closeModal);
    btn.addEventListener('click',async function(){
        if(inp.value!==group.name)return;
        try{await sbDeleteGroup(group.id);}catch(e2){console.error('Delete group:',e2);}
        var idx=groups.indexOf(group);
        if(idx!==-1)groups.splice(idx,1);
        delete state.joinedGroups[group.id];
        if(state.groupPosts)delete state.groupPosts[group.id];
        saveState();
        addNotification('group','You deleted the group "'+group.name+'"');
        closeModal();renderGroups();navigateTo('groups');
    });
}

function showSelfRoleRemovalModal(group,callback){
    var myName=currentUser?(currentUser.display_name||currentUser.username):'User';
    var h='<div class="modal-header"><h3>Remove Your Role</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
    h+='<p style="text-align:center;margin-bottom:8px;">You will be downgraded to <strong>Member</strong>.</p>';
    h+='<label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Type your name to confirm:</label>';
    h+='<input type="text" class="post-input" id="selfRemoveInput" placeholder="'+myName+'" style="width:100%;margin-bottom:16px;">';
    h+='<div class="modal-actions"><button class="btn btn-outline" id="selfRemoveCancel">Cancel</button><button class="btn btn-primary" id="selfRemoveConfirm" disabled style="background:#e74c3c;border-color:#e74c3c;opacity:.5;">Confirm</button></div></div>';
    showModal(h);
    var inp=document.getElementById('selfRemoveInput'),btn=document.getElementById('selfRemoveConfirm');
    inp.addEventListener('input',function(){var match=inp.value===myName;btn.disabled=!match;btn.style.opacity=match?'1':'.5';});
    document.getElementById('selfRemoveCancel').addEventListener('click',closeModal);
    btn.addEventListener('click',function(){if(inp.value!==myName)return;callback();});
}

async function showGroupMembersModal(group){
    var members=[];
    try{members=await sbGetGroupMembers(group.id);}catch(e){console.error(e);}
    var html='<div class="modal-header"><h3>'+group.name+' — Members</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
    if(!members.length){html+='<p style="text-align:center;color:var(--gray);">No members yet.</p>';}
    else{
        html+='<div class="follow-list">';
        members.forEach(function(m){
            var p=m.user||{};
            var name=p.display_name||p.username||'User';
            var avatar=p.avatar_url||DEFAULT_AVATAR;
            var bio=p.bio||'';
            var followed=state.followedUsers[p.id];
            var isSelf=currentUser&&p.id===currentUser.id;
            var isOwner=p.id===group.owner_id;
            var roleTag=isOwner?' <span style="font-size:10px;background:#e74c3c;color:#fff;padding:2px 6px;border-radius:8px;margin-left:4px;">Admin</span>':'';
            html+='<div class="follow-list-item" style="flex-wrap:wrap;"><img src="'+avatar+'" alt="'+name+'" class="gvm-click" data-person-id="'+p.id+'" style="cursor:pointer;"><div class="follow-list-info" style="flex:1;"><h4>'+name+roleTag+'</h4><p>'+bio+'</p></div>';
            if(!isSelf) html+='<button class="btn follow-btn-small '+(followed?'btn-disabled':'btn-green')+' gvm-follow-btn" data-uid="'+p.id+'">'+(followed?'<i class="fas fa-check"></i>':'<i class="fas fa-plus"></i>')+'</button>';
            html+='</div>';
        });
        html+='</div>';
    }
    html+='</div>';
    showModal(html);
    $$('.gvm-follow-btn').forEach(function(btn){btn.addEventListener('click',function(){toggleFollow(btn.dataset.uid,btn);});});
    $$('.gvm-click').forEach(function(img){img.addEventListener('click',async function(){
        var uid=img.dataset.personId;if(!uid)return;
        try{var p=await sbGetProfile(uid);if(p){closeModal();showGroupProfileModal({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url},group);}}catch(e){}
    });});
}

// ======================== GROUP VIEW PAGE ========================
async function showGroupView(group){
    $$('.page').forEach(function(p){p.classList.remove('active');});
    document.getElementById('page-group-view').classList.add('active');
    $$('.nav-link').forEach(function(l){l.classList.remove('active');});
    _navPrev=_navCurrent;_navCurrent='group-view';
    window.scrollTo(0,0);

    var joined=state.joinedGroups[group.id];
    var isOwner=currentUser&&group.owner_id===currentUser.id;
    var themeColor=getGroupThemeColor(group);
    var banner=$('#gvCoverBanner');
    banner.style.background=group.coverPhoto?'url('+group.coverPhoto+') center/cover':themeColor;
    var coverBtn=$('#gvCoverEditBtn');
    coverBtn.style.display=isOwner?'flex':'none';

    // Profile card
    var cardHtml='<div class="profile-cover" style="background:'+themeColor+';"></div>';
    cardHtml+='<div class="profile-info">';
    if(group.profileImg){
        cardHtml+='<div class="profile-avatar-wrap"><img src="'+group.profileImg+'" class="profile-avatar" style="object-fit:cover;">';
        if(isOwner) cardHtml+='<button class="avatar-edit-btn" id="gvIconEditBtn" title="Change Photo"><i class="fas fa-camera"></i></button>';
        cardHtml+='<input type="file" id="gvProfileImgInput" accept="image/*" style="display:none;">';
        cardHtml+='</div>';
    } else {
        cardHtml+='<div class="profile-avatar-wrap"><div class="gv-icon-wrap" style="background:'+themeColor+';">';
        cardHtml+='<i class="fas '+group.icon+'" id="gvIconDisplay"></i>';
        if(isOwner) cardHtml+='<button class="avatar-edit-btn" id="gvIconEditBtn" title="Change Icon"><i class="fas fa-camera"></i></button>';
        cardHtml+='<input type="file" id="gvProfileImgInput" accept="image/*" style="display:none;">';
        cardHtml+='</div></div>';
    }
    cardHtml+='<h3 class="profile-name">'+group.name+'</h3>';
    cardHtml+='<p class="profile-title">'+(group.description||group.desc||'')+'</p>';
    var memberCount=group.member_count&&group.member_count[0]?group.member_count[0].count:(group.members||0);
    cardHtml+='<div class="profile-stats"><div class="stat"><span class="stat-count">'+fmtNum(memberCount)+'</span><span class="stat-label">Members</span></div><div class="stat"><span class="stat-count" id="gvPostCount">0</span><span class="stat-label">Posts</span></div><div class="stat" id="gvGroupCoins"><span class="stat-count" id="gvGroupCoinCount" style="color:#f59e0b;">'+getGroupCoinCount(group.id)+'</span><span class="stat-label"><i class="fas fa-coins" style="color:#f59e0b;font-size:11px;"></i> Group Coins</span></div></div>';
    cardHtml+='<div class="pv-actions">';
    if(isOwner) cardHtml+='<button class="btn btn-outline" id="gvEditBtn"><i class="fas fa-pen"></i> Edit Group</button>';
    cardHtml+='<button class="btn '+(joined?'btn-disabled':'btn-primary')+'" id="gvJoinBtn" data-gid="'+group.id+'">'+(joined?'Joined':'Join Group')+'</button>';
    if(joined||isOwner) cardHtml+='<button class="btn btn-outline" id="gvLeaveBtn" style="color:#e74c3c;border-color:#e74c3c;"><i class="fas fa-right-from-bracket"></i> Leave Group</button>';
    cardHtml+='</div>';
    cardHtml+='<a href="#" class="pv-back-link" id="gvBack"><i class="fas fa-arrow-left"></i> Back to Groups</a>';
    cardHtml+='</div>';
    $('#gvProfileCard').innerHTML=cardHtml;

    // Left sidebar - About + Admin/Mods
    var adminName=group.owner?(group.owner.display_name||group.owner.username):(group.adminName||'Admin');
    var amIAdmin=currentUser&&group.owner_id===currentUser.id;
    var leftHtml='<div class="card gv-about-card"><h4 class="card-heading"><i class="fas fa-info-circle" style="color:var(--primary);margin-right:6px;"></i>About</h4>';
    leftHtml+='<div class="gv-about-body"><div class="gv-about-meta"><span><i class="fas fa-calendar"></i> Created recently</span>';
    leftHtml+='<span><i class="fas fa-globe"></i> Public group</span></div></div></div>';
    leftHtml+='<div class="card gv-staff-card"><h4 class="card-heading"><i class="fas fa-shield-halved" style="color:var(--primary);margin-right:6px;"></i>Admin & Mods</h4><div class="gv-staff-list">';
    var adminAvatar=(group.owner&&group.owner.avatar_url)?group.owner.avatar_url:(group.adminImg||DEFAULT_AVATAR);
    leftHtml+='<div class="gv-staff-item"><img src="'+adminAvatar+'" style="object-fit:cover;"><div><strong>'+adminName+'</strong><span class="gv-staff-role admin">Admin'+(amIAdmin?' (You)':'')+'</span></div></div>';
    if(group.mods&&group.mods.length){group.mods.forEach(function(m){var modAvatar=m.img||m.avatar_url||DEFAULT_AVATAR;var roleClass=m.role==='Co-Admin'?'coadmin':'mod';leftHtml+='<div class="gv-staff-item"><img src="'+modAvatar+'" style="object-fit:cover;"><div><strong>'+m.name+'</strong><span class="gv-staff-role '+roleClass+'">'+m.role+'</span></div></div>';});}
    leftHtml+='</div></div>';
    if(amIAdmin) leftHtml+='<button class="btn btn-outline btn-block" id="gvDeleteGroupBtn" style="color:#e74c3c;border-color:#e74c3c;margin-top:12px;"><i class="fas fa-trash"></i> Delete Group</button>';
    $('#gvLeftSidebar').innerHTML=leftHtml;

    // Right sidebar - rules + members preview
    if(!group.rules) group.rules=['Be respectful to all members','No spam or self-promotion','Stay on topic','No hate speech'];
    var rightHtml='<div class="card gv-rules-card"><h4 class="card-heading"><i class="fas fa-scroll" style="color:var(--primary);margin-right:6px;"></i>Group Rules';
    if(isOwner) rightHtml+='<button class="gv-edit-rules-btn" id="gvEditRulesBtn" title="Edit Rules"><i class="fas fa-pen"></i></button>';
    rightHtml+='</h4><div class="gv-rules-body"><ol>';
    group.rules.forEach(function(r){rightHtml+='<li>'+r+'</li>';});
    rightHtml+='</ol></div></div>';
    rightHtml+='<div class="card"><h4 class="card-heading"><i class="fas fa-user-friends" style="color:var(--primary);margin-right:6px;"></i>Members</h4><div class="gv-members-preview" id="gvMembersPreview">';
    rightHtml+='<p style="color:var(--gray);font-size:13px;">Loading members...</p>';
    rightHtml+='</div></div>';
    $('#gvRightSidebar').innerHTML=rightHtml;

    // Load members preview asynchronously
    (async function(){
        try{
            var members=await sbGetGroupMembers(group.id);
            var preview=document.getElementById('gvMembersPreview');
            if(!preview)return;
            if(!members.length){preview.innerHTML='<p style="color:var(--gray);font-size:13px;">No members yet.</p>';return;}
            var html='';
            members.slice(0,6).forEach(function(m){
                var p=m.user||{};
                var name=p.display_name||p.username||'User';
                var avatar=p.avatar_url||DEFAULT_AVATAR;
                html+='<img src="'+avatar+'" title="'+name+'" class="gv-member-click" data-person-id="'+p.id+'" style="cursor:pointer;">';
            });
            var moreCount=Math.max(0,members.length-6);
            if(moreCount>0) html+='<span class="gv-members-more" id="gvShowAllMembers" style="cursor:pointer;">+'+moreCount+' more</span>';
            preview.innerHTML=html;
            $$('.gv-member-click').forEach(function(img){img.addEventListener('click',async function(){
                var uid=img.dataset.personId;if(!uid)return;
                try{var p=await sbGetProfile(uid);if(p)showGroupProfileModal({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url},group);}catch(e){}
            });});
            var showAllBtn=document.getElementById('gvShowAllMembers');
            if(showAllBtn)showAllBtn.addEventListener('click',function(){showGroupMembersModal(group);});
        }catch(e){console.error('gvMembers:',e);}
    })();

    // Post bar (only if joined)
    if(joined||isOwner){
        $('#gvPostBar').innerHTML='<div class="card post-create-bar" id="gvOpenPostModal"><img src="'+$('#profileAvatarImg').src+'" alt="User" class="post-create-avatar"><div class="post-input-fake">Post in '+group.name+'...</div></div>';
        document.getElementById('gvOpenPostModal').addEventListener('click',function(){openGroupPostModal(group);});
    } else {
        $('#gvPostBar').innerHTML='';
    }

    // Feed posts
    var feedHtml='<div class="card"><h4 class="pv-posts-heading"><i class="fas fa-stream" style="color:var(--primary);margin-right:8px;"></i>Group Posts</h4></div>';
    var groupPosts=state.groupPosts&&state.groupPosts[group.id]?state.groupPosts[group.id]:[];
    groupPosts.forEach(function(p,i){
        feedHtml+='<div class="card feed-post"><div class="post-header"><img src="'+p.avatar+'" alt="'+p.name+'" class="post-avatar"><div class="post-user-info"><div class="post-user-top"><h4 class="post-username">'+p.name+'</h4><span class="post-time">'+p.time+'</span></div><div class="post-badges"><span class="badge badge-green"><i class="fas fa-user"></i> You</span></div></div></div>';
        feedHtml+='<div class="post-description"><p>'+p.text+'</p>'+(p.media||'')+'</div>';
        feedHtml+='<div class="post-actions"><div class="action-left"><button class="action-btn like-btn" data-post-id="gvp-'+group.id+'-'+i+'"><i class="far fa-thumbs-up"></i><span class="like-count">0</span></button><button class="action-btn dislike-btn" data-post-id="gvp-'+group.id+'-'+i+'"><i class="far fa-thumbs-down"></i><span class="dislike-count">0</span></button><button class="action-btn comment-btn"><i class="far fa-comment"></i><span>0</span></button></div></div></div>';
    });
    if(!groupPosts.length){
        feedHtml+='<div class="card" style="padding:40px;text-align:center;color:var(--gray);"><i class="fas fa-pen" style="font-size:32px;margin-bottom:12px;display:block;"></i><p>No posts in this group yet.</p></div>';
    }
    $('#gvPostsFeed').innerHTML=feedHtml;
    $('#gvPostCount').textContent=groupPosts.length;

    // Mode tabs (Feed / Group Shop) — remove old ones first to prevent duplicates
    var _oldTabs=document.getElementById('gvModeTabs');if(_oldTabs)_oldTabs.remove();
    var _oldShop=document.getElementById('gvShopSection');if(_oldShop)_oldShop.remove();
    var gvModeHtml='<div class="search-tabs" id="gvModeTabs">';
    gvModeHtml+='<button class="search-tab active" data-gvmode="feed"><i class="fas fa-stream"></i> Feed</button>';
    if(joined||isOwner) gvModeHtml+='<button class="search-tab" data-gvmode="shop"><i class="fas fa-store"></i> Group Shop</button>';
    gvModeHtml+='</div>';
    $('#gvPostBar').insertAdjacentHTML('beforebegin',gvModeHtml);

    // Shop container (hidden by default)
    var shopSectionHtml='<div id="gvShopSection" style="display:none;">';
    shopSectionHtml+='<div class="card gv-shop-header"><div class="gv-shop-title"><i class="fas fa-store"></i> Group Shop</div>';
    shopSectionHtml+='<div class="gv-shop-coins"><i class="fas fa-coins"></i> <span id="gvGroupCoinCount2">'+getGroupCoinCount(group.id)+'</span> Group Coins</div></div>';
    shopSectionHtml+='<div class="search-tabs" id="gvShopTabs"></div>';
    shopSectionHtml+='<div id="gvShopContent"></div>';
    shopSectionHtml+='</div>';
    $('#gvPostsFeed').insertAdjacentHTML('afterend',shopSectionHtml);

    // Apply active group skin
    applyGroupSkin(group.id);

    // Event listeners
    document.getElementById('gvBack').addEventListener('click',function(e){e.preventDefault();navigateTo('groups');});
    var joinBtn=document.getElementById('gvJoinBtn');
    if(joinBtn){joinBtn.addEventListener('click',async function(){if(!state.joinedGroups[group.id]&&currentUser){try{await sbJoinGroup(group.id,currentUser.id);state.joinedGroups[group.id]=true;group.members++;saveState();this.textContent='Joined';this.classList.remove('btn-primary');this.classList.add('btn-disabled');addNotification('group','You joined "'+group.name+'"');showGroupView(group);}catch(e2){console.error('Join group:',e2);showToast('Failed to join group');}}});}
    var leaveBtn=document.getElementById('gvLeaveBtn');
    if(leaveBtn){leaveBtn.addEventListener('click',function(){
        var myRole=getMyGroupRole(group);
        if(myRole==='Admin'){
            var coAdmin=group.mods.find(function(m){return m.role==='Co-Admin';});
            if(coAdmin){
                // Auto-promote Co-Admin and leave
                var h='<div class="modal-header"><h3>Leave Group</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
                h+='<p style="text-align:center;margin-bottom:6px;">Are you sure you want to leave <strong>'+group.name+'</strong>?</p>';
                h+='<p style="text-align:center;color:var(--gray);font-size:13px;margin-bottom:16px;"><strong>'+coAdmin.name+'</strong> will be promoted to Admin.</p>';
                h+='<div class="modal-actions"><button class="btn btn-outline" id="gvLeaveCancel">Cancel</button><button class="btn btn-primary" id="gvLeaveConfirm" style="background:#e74c3c;border-color:#e74c3c;">Leave</button></div></div>';
                showModal(h);
                document.getElementById('gvLeaveCancel').addEventListener('click',closeModal);
                document.getElementById('gvLeaveConfirm').addEventListener('click',function(){
                    group.mods=group.mods.filter(function(m){return m.name!==coAdmin.name;});
                    group.createdBy=coAdmin.name;group.adminName=coAdmin.name;group.adminImg=coAdmin.img;
                    delete state.joinedGroups[group.id];group.members=Math.max(0,group.members-1);
                    addNotification('group','You left "'+group.name+'". '+coAdmin.name+' is now Admin.');
                    closeModal();renderGroups();navigateTo('groups');
                });
            } else {
                var h='<div class="modal-header"><h3>Cannot Leave</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
                h+='<p style="text-align:center;color:var(--gray);margin-bottom:16px;">You are the only Admin of this group.</p>';
                h+='<p style="text-align:center;font-weight:600;margin-bottom:16px;">Transfer ownership before leaving.</p>';
                h+='<div class="modal-actions"><button class="btn btn-primary modal-close-btn">OK</button></div></div>';
                showModal(h);$$('.modal-close-btn').forEach(function(b){b.addEventListener('click',closeModal);});
            }
        } else if(myRole==='Co-Admin'||myRole==='Moderator'){
            showSelfRoleRemovalModal(group,function(){
                var _myName=currentUser?(currentUser.display_name||currentUser.username):'Me';
                group.mods=group.mods.filter(function(m){return m.name!==_myName;});
                delete state.joinedGroups[group.id];group.members=Math.max(0,group.members-1);
                addNotification('group','You left "'+group.name+'"');
                closeModal();renderGroups();navigateTo('groups');
            });
        } else {
            var h='<div class="modal-header"><h3>Leave Group</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
            h+='<p style="text-align:center;margin-bottom:16px;">Are you sure you want to leave <strong>'+group.name+'</strong>?</p>';
            h+='<div class="modal-actions"><button class="btn btn-outline" id="gvLeaveCancel">Cancel</button><button class="btn btn-primary" id="gvLeaveConfirm" style="background:#e74c3c;border-color:#e74c3c;">Leave</button></div></div>';
            showModal(h);
            document.getElementById('gvLeaveCancel').addEventListener('click',closeModal);
            document.getElementById('gvLeaveConfirm').addEventListener('click',async function(){
                if(currentUser){try{await sbLeaveGroup(group.id,currentUser.id);}catch(e2){}}
                delete state.joinedGroups[group.id];group.members=Math.max(0,group.members-1);
                saveState();
                addNotification('group','You left "'+group.name+'"');
                closeModal();renderGroups();navigateTo('groups');
            });
        }
    });}
    var editBtn=document.getElementById('gvEditBtn');
    if(editBtn){editBtn.addEventListener('click',function(){
        var html='<div class="modal-header"><h3>Edit Group</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
        html+='<div style="margin-bottom:14px;"><label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Group Name</label><input type="text" class="post-input" id="editGrpName" value="'+group.name+'" style="width:100%;"></div>';
        html+='<div style="margin-bottom:14px;"><label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Description</label><input type="text" class="post-input" id="editGrpDesc" value="'+(group.description||group.desc||'')+'" style="width:100%;"></div>';
        html+='<button class="btn btn-primary btn-block" id="saveGrpBtn">Save Changes</button></div>';
        showModal(html);
        document.getElementById('saveGrpBtn').addEventListener('click',function(){
            group.name=document.getElementById('editGrpName').value.trim()||group.name;
            group.description=document.getElementById('editGrpDesc').value.trim()||group.description||group.desc||'';
            closeModal();showGroupView(group);renderGroups();
        });
    });}
    // Cover photo edit for owned groups
    if(isOwner){
        if(!group.photos) group.photos={profile:[],cover:[]};
        $('#gvCoverEditBtn').addEventListener('click',function(e){
            e.stopPropagation();
            var photos=group.photos.cover;
            var h='<div class="modal-header"><h3>Change Cover Photo</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
            h+='<div style="text-align:center;margin-bottom:16px;"><button class="btn btn-primary" id="gvCoverUploadNewBtn"><i class="fas fa-upload"></i> Upload New Photo</button></div>';
            if(photos.length>0){
                h+='<p style="font-size:13px;color:var(--gray);margin-bottom:12px;text-align:center;">Or select from previous uploads:</p>';
                h+='<div class="shop-scroll-row" id="gvCoverPickRow" style="gap:12px;padding:8px 4px 12px;">';
                photos.forEach(function(p,i){h+='<img src="'+p.src+'" class="gv-cover-pick-thumb" data-idx="'+i+'" style="min-width:140px;max-width:140px;height:50px;object-fit:cover;border-radius:8px;cursor:pointer;border:3px solid transparent;transition:border-color .2s;flex-shrink:0;scroll-snap-align:start;">';});
                h+='</div>';
            }
            h+='</div>';
            showModal(h);
            if(photos.length>0) initDragScroll('#modalContent');
            document.getElementById('gvCoverUploadNewBtn').addEventListener('click',function(){closeModal();$('#gvCoverFileInput').click();});
            $$('.gv-cover-pick-thumb').forEach(function(thumb){
                thumb.addEventListener('mouseenter',function(){thumb.style.borderColor='var(--primary)';});
                thumb.addEventListener('mouseleave',function(){thumb.style.borderColor='transparent';});
                thumb.addEventListener('click',function(){
                    var src=photos[parseInt(thumb.dataset.idx)].src;
                    group.coverPhoto=src;banner.style.background='url('+src+') center/cover';closeModal();
                });
            });
        });
        $('#gvCoverFileInput').addEventListener('change',function(){
            var f=this.files[0];if(!f)return;
            var r=new FileReader();
            r.onload=function(e){showGroupCoverCropModal(e.target.result,group,banner);};
            r.readAsDataURL(f);
        });
        var iconBtn=document.getElementById('gvIconEditBtn');
        if(iconBtn){iconBtn.addEventListener('click',function(){
            if(!group.photos) group.photos={profile:[],cover:[]};
            var icons=['fa-users','fa-camera-retro','fa-gamepad','fa-utensils','fa-dumbbell','fa-music','fa-paw','fa-plane-departure','fa-book','fa-leaf','fa-film','fa-hammer','fa-mug-hot','fa-code','fa-palette','fa-rocket','fa-heart','fa-star'];
            var photos=group.photos.profile;
            var h='<div class="modal-header"><h3>Group Image</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
            h+='<div style="text-align:center;margin-bottom:16px;"><button class="btn btn-primary" id="gvUploadPhotoBtn"><i class="fas fa-upload"></i> Upload New Photo</button></div>';
            h+='<input type="file" id="gvModalImgInput" accept="image/*,image/gif" style="display:none;">';
            if(photos.length>0){
                h+='<p style="font-size:13px;color:var(--gray);margin-bottom:12px;text-align:center;">Or select from previous uploads:</p>';
                h+='<div class="shop-scroll-row" id="gvProfilePickRow" style="gap:12px;padding:8px 4px 12px;">';
                photos.forEach(function(p,i){h+='<img src="'+p.src+'" class="gv-profile-pick-thumb" data-idx="'+i+'" style="min-width:80px;max-width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:3px solid transparent;transition:border-color .2s;flex-shrink:0;scroll-snap-align:start;">';});
                h+='</div>';
            }
            h+='<p style="text-align:center;color:var(--gray);font-size:13px;margin:12px 0;">Or pick an icon:</p>';
            h+='<div class="gv-icon-grid">';
            icons.forEach(function(ic){h+='<button class="gv-icon-pick'+(group.icon===ic&&!group.profileImg?' active':'')+'" data-icon="'+ic+'"><i class="fas '+ic+'"></i></button>';});
            h+='</div></div>';showModal(h);
            if(photos.length>0) initDragScroll('#modalContent');
            document.getElementById('gvUploadPhotoBtn').addEventListener('click',function(){document.getElementById('gvModalImgInput').click();});
            document.getElementById('gvModalImgInput').addEventListener('change',function(){
                var f=this.files[0];if(!f)return;
                var isGif=f.type==='image/gif';
                var r=new FileReader();
                r.onload=function(e){
                    if(isGif){
                        group.profileImg=e.target.result;
                        if(!group.photos) group.photos={profile:[],cover:[]};
                        group.photos.profile.unshift({src:e.target.result,date:Date.now()});
                        closeModal();showGroupView(group);renderGroups();
                    } else {
                        showGroupProfileCropModal(e.target.result,group);
                    }
                };
                r.readAsDataURL(f);
            });
            $$('.gv-profile-pick-thumb').forEach(function(thumb){
                thumb.addEventListener('mouseenter',function(){thumb.style.borderColor='var(--primary)';});
                thumb.addEventListener('mouseleave',function(){thumb.style.borderColor='transparent';});
                thumb.addEventListener('click',function(){
                    var src=photos[parseInt(thumb.dataset.idx)].src;
                    group.profileImg=src;closeModal();showGroupView(group);renderGroups();
                });
            });
            $$('.gv-icon-pick').forEach(function(btn){btn.addEventListener('click',function(){group.icon=btn.dataset.icon;delete group.profileImg;closeModal();showGroupView(group);renderGroups();});});
        });}
    }
    var rulesBtn=document.getElementById('gvEditRulesBtn');
    if(rulesBtn){rulesBtn.addEventListener('click',function(){
        var h='<div class="modal-header"><h3>Edit Rules</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
        group.rules.forEach(function(r,i){h+='<div style="margin-bottom:8px;display:flex;gap:8px;align-items:center;"><span style="font-weight:600;color:var(--gray);">'+(i+1)+'.</span><input type="text" class="post-input gv-rule-input" value="'+r+'" style="flex:1;"><button class="gv-rule-del" data-idx="'+i+'" style="background:none;color:var(--gray);font-size:14px;padding:4px;"><i class="fas fa-trash"></i></button></div>';});
        h+='<button class="btn btn-outline" id="gvAddRule" style="margin:8px 0 16px;font-size:13px;"><i class="fas fa-plus"></i> Add Rule</button>';
        h+='<button class="btn btn-primary btn-block" id="gvSaveRules">Save Rules</button></div>';
        showModal(h);
        document.getElementById('gvAddRule').addEventListener('click',function(){
            var container=this.parentElement;
            var inputs=container.querySelectorAll('.gv-rule-input');
            var idx=inputs.length;
            var div=document.createElement('div');div.style.cssText='margin-bottom:8px;display:flex;gap:8px;align-items:center;';
            div.innerHTML='<span style="font-weight:600;color:var(--gray);">'+(idx+1)+'.</span><input type="text" class="post-input gv-rule-input" placeholder="New rule..." style="flex:1;"><button class="gv-rule-del" data-idx="'+idx+'" style="background:none;color:var(--gray);font-size:14px;padding:4px;"><i class="fas fa-trash"></i></button>';
            container.insertBefore(div,this);
        });
        document.getElementById('gvSaveRules').addEventListener('click',function(){
            var inputs=$$('.gv-rule-input');
            group.rules=[];inputs.forEach(function(inp){var v=inp.value.trim();if(v)group.rules.push(v);});
            closeModal();showGroupView(group);
        });
        $$('.gv-rule-del').forEach(function(btn){btn.addEventListener('click',function(){btn.parentElement.remove();});});
    });}
    $$('.gv-member-click').forEach(function(img){img.addEventListener('click',async function(){
        var uid=img.dataset.personId;if(!uid)return;
        try{var p=await sbGetProfile(uid);if(p)showGroupProfileModal({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url},group);}catch(e){}
    });});
    $$('.gv-staff-click').forEach(function(img){img.addEventListener('click',async function(){
        var uid=img.dataset.personId;if(!uid)return;
        try{var p=await sbGetProfile(uid);if(p)showGroupProfileModal({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url},group);}catch(e){}
    });});
    var showAllBtn=document.getElementById('gvShowAllMembers');
    if(showAllBtn){showAllBtn.addEventListener('click',function(){showGroupMembersModal(group);});}
    var deleteGrpBtn=document.getElementById('gvDeleteGroupBtn');
    if(deleteGrpBtn){deleteGrpBtn.addEventListener('click',function(){showDeleteGroupModal(group);});}
    // Group view mode tab switching
    $$('#gvModeTabs .search-tab').forEach(function(tab){tab.addEventListener('click',function(){
        $$('#gvModeTabs .search-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');
        var mode=tab.dataset.gvmode;
        if(mode==='feed'){
            $('#gvPostBar').style.display='';$('#gvPostsFeed').style.display='';
            var ss=document.getElementById('gvShopSection');if(ss)ss.style.display='none';
        } else if(mode==='shop'){
            $('#gvPostBar').style.display='none';$('#gvPostsFeed').style.display='none';
            var ss=document.getElementById('gvShopSection');if(ss){ss.style.display='';renderGroupShop(group.id);}
        }
    });});
    // Swipe left/right to switch Feed <-> Group Shop
    var _gvCenter=document.querySelector('#page-group-view .gv-center');
    if(_gvCenter&&(joined||isOwner)){
        var _gvTx=0;
        _gvCenter.addEventListener('touchstart',function(e){_gvTx=e.touches[0].clientX;},{passive:true});
        _gvCenter.addEventListener('touchend',function(e){
            var dx=e.changedTouches[0].clientX-_gvTx;
            if(Math.abs(dx)<50) return;
            var modes=['feed','shop'];
            var feedVis=$('#gvPostsFeed').style.display!=='none';
            var cur=feedVis?0:1;
            var next=dx<0?cur+1:cur-1;
            if(next<0||next>=modes.length) return;
            $$('#gvModeTabs .search-tab').forEach(function(t){t.classList.toggle('active',t.dataset.gvmode===modes[next]);});
            if(modes[next]==='feed'){
                $('#gvPostBar').style.display='';$('#gvPostsFeed').style.display='';
                var ss=document.getElementById('gvShopSection');if(ss)ss.style.display='none';
            } else {
                $('#gvPostBar').style.display='none';$('#gvPostsFeed').style.display='none';
                var ss=document.getElementById('gvShopSection');if(ss){ss.style.display='';renderGroupShop(group.id);}
            }
        });
    }
    bindGvPostEvents();
}

function bindGvPostEvents(){
    $$('#gvPostsFeed .like-btn').forEach(function(btn){btn.addEventListener('click',function(e){if(e.target.classList.contains('like-count'))return;var pid=btn.getAttribute('data-post-id');var countEl=btn.querySelector('.like-count');var count=parseInt(countEl.textContent);var had=!!(state.likedPosts[pid]||state.dislikedPosts[pid]);if(state.likedPosts[pid]){delete state.likedPosts[pid];btn.classList.remove('liked');btn.querySelector('i').className='far fa-thumbs-up';countEl.textContent=count-1;}else{if(state.dislikedPosts[pid]){var db=btn.closest('.action-left').querySelector('.dislike-btn');var dc=db.querySelector('.dislike-count');dc.textContent=parseInt(dc.textContent)-1;delete state.dislikedPosts[pid];db.classList.remove('disliked');db.querySelector('i').className='far fa-thumbs-down';}state.likedPosts[pid]=true;btn.classList.add('liked');btn.querySelector('i').className='fas fa-thumbs-up';countEl.textContent=count+1;}var has=!!(state.likedPosts[pid]||state.dislikedPosts[pid]);if(!had&&has){state.coins++;updateCoins();var _glm=pid.match(/^gvp?-(\d+)-/);if(_glm)addGroupCoins(parseInt(_glm[1]),1);}else if(had&&!has){state.coins--;updateCoins();var _glm2=pid.match(/^gvp?-(\d+)-/);if(_glm2&&(state.groupCoins[parseInt(_glm2[1])]||0)>0)addGroupCoins(parseInt(_glm2[1]),-1);}});});
    $$('#gvPostsFeed .dislike-btn').forEach(function(btn){btn.addEventListener('click',function(){var pid=btn.getAttribute('data-post-id');var countEl=btn.querySelector('.dislike-count');var count=parseInt(countEl.textContent);var had=!!(state.likedPosts[pid]||state.dislikedPosts[pid]);if(state.dislikedPosts[pid]){delete state.dislikedPosts[pid];btn.classList.remove('disliked');btn.querySelector('i').className='far fa-thumbs-down';countEl.textContent=count-1;}else{if(state.likedPosts[pid]){var lb=btn.closest('.action-left').querySelector('.like-btn');var lc=lb.querySelector('.like-count');lc.textContent=parseInt(lc.textContent)-1;delete state.likedPosts[pid];lb.classList.remove('liked');lb.querySelector('i').className='far fa-thumbs-up';}state.dislikedPosts[pid]=true;btn.classList.add('disliked');btn.querySelector('i').className='fas fa-thumbs-down';countEl.textContent=count+1;}var has=!!(state.likedPosts[pid]||state.dislikedPosts[pid]);if(!had&&has){state.coins++;updateCoins();var _gdm=pid.match(/^gvp?-(\d+)-/);if(_gdm)addGroupCoins(parseInt(_gdm[1]),1);}else if(had&&!has){state.coins--;updateCoins();var _gdm2=pid.match(/^gvp?-(\d+)-/);if(_gdm2&&(state.groupCoins[parseInt(_gdm2[1])]||0)>0)addGroupCoins(parseInt(_gdm2[1]),-1);}});});
    $$('#gvPostsFeed .comment-btn').forEach(function(btn){btn.addEventListener('click',function(){var postId=btn.closest('.action-left').querySelector('.like-btn').getAttribute('data-post-id');showComments(postId,btn.querySelector('span'));});});
    bindLikeCountClicks('#gvPostsFeed');
}

function openGroupPostModal(group){
    var html='<div class="create-post-modal"><div class="modal-header"><h3>Post in '+group.name+'</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body"><div style="display:flex;align-items:center;gap:10px;padding:16px 20px 0;"><img src="'+$('#profileAvatarImg').src+'" style="width:40px;height:40px;border-radius:50%;"><strong style="font-size:14px;">'+(currentUser?(currentUser.display_name||currentUser.username):'You')+'</strong></div>';
    html+='<textarea class="cpm-textarea" id="gvCpmText" placeholder="Write something..."></textarea>';
    html+='<div class="cpm-media-zone" id="gvCpmMediaZone"><div class="cpm-media-grid" id="gvCpmGrid"></div><div id="gvCpmDropZone"><i class="fas fa-photo-video"></i><br>Add Photos/Videos</div><input type="file" accept="image/*,video/*" multiple id="gvCpmFileInput" style="display:none;"></div>';
    html+='<div class="cpm-footer"><button class="btn btn-primary" id="gvCpmPublish">Publish</button></div></div></div>';
    showModal(html);
    var mediaList=[];
    var zone=document.getElementById('gvCpmMediaZone'),grid=document.getElementById('gvCpmGrid'),dropZone=document.getElementById('gvCpmDropZone'),fileInput=document.getElementById('gvCpmFileInput');
    dropZone.addEventListener('click',function(){fileInput.click();});
    function renderGrid(){
        grid.innerHTML='';mediaList.forEach(function(m,i){var t=document.createElement('div');t.className='cpm-thumb';t.innerHTML=(m.type==='video'?'<video src="'+m.src+'" muted></video>':'<img src="'+m.src+'">')+'<button class="remove-thumb" data-idx="'+i+'"><i class="fas fa-times"></i></button>';grid.appendChild(t);});
        zone.classList.toggle('has-media',mediaList.length>0);
        grid.querySelectorAll('.remove-thumb').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();mediaList.splice(parseInt(btn.dataset.idx),1);renderGrid();});});
    }
    fileInput.addEventListener('change',function(){Array.from(this.files).forEach(function(f){var isV=f.type.startsWith('video/');var r=new FileReader();r.onload=function(e){mediaList.push({src:e.target.result,type:isV?'video':'image'});renderGrid();};r.readAsDataURL(f);});this.value='';});
    document.getElementById('gvCpmPublish').addEventListener('click',function(){
        var text=document.getElementById('gvCpmText').value.trim();
        if(!text&&!mediaList.length)return;
        if(!state.groupPosts) state.groupPosts={};
        if(!state.groupPosts[group.id]) state.groupPosts[group.id]=[];
        var mediaHtml='';
        if(mediaList.length>0){var cnt=Math.min(mediaList.length,5);mediaHtml='<div class="post-media-grid pm-count-'+cnt+'">';mediaList.slice(0,5).forEach(function(m){mediaHtml+='<div class="pm-thumb">'+(m.type==='video'?'<video src="'+m.src+'" controls></video>':'<img src="'+m.src+'">')+'</div>';});mediaHtml+='</div>';}
        state.groupPosts[group.id].unshift({name:currentUser?(currentUser.display_name||currentUser.username):'You',avatar:$('#profileAvatarImg').src,text:text,media:mediaHtml,time:'just now'});
        if(state.postCoinCount<10){state.coins+=5;state.postCoinCount++;updateCoins();}
        if(canEarnGroupPostCoin(group.id)){addGroupCoins(group.id,5);trackGroupPostCoin(group.id);}
        closeModal();showGroupView(group);
    });
}

// Cover photo upload with crop
$('#coverEditBtn').addEventListener('click',function(e){e.stopPropagation();$('#coverFileInput').click();});
$('#coverFileInput').addEventListener('change',function(){
    var file=this.files[0];
    if(!file) return;
    var reader=new FileReader();
    reader.onload=function(e){showCoverCropModal(e.target.result);};
    reader.readAsDataURL(file);
});
function showCoverCropModal(src){
    var html='<div class="modal-header"><h3>Crop Cover Photo</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body" style="text-align:center;"><p style="font-size:13px;color:var(--gray);margin-bottom:12px;">Drag to position. Resize the selection area.</p><div class="crop-container" id="coverCropContainer" style="position:relative;display:inline-block;max-width:100%;overflow:hidden;"><img src="'+src+'" id="coverCropImg" style="max-width:100%;display:block;"><div id="coverCropBox" style="position:absolute;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.5);cursor:move;"><div id="coverCropResize" style="position:absolute;bottom:-4px;right:-4px;width:12px;height:12px;background:#fff;border:1px solid #333;cursor:nwse-resize;"></div></div></div>';
    html+='<div style="margin-top:16px;"><button class="btn btn-primary" id="coverCropConfirmBtn">Apply</button></div></div>';
    showModal(html);

    var img=document.getElementById('coverCropImg');
    var box=document.getElementById('coverCropBox');
    var resizeHandle=document.getElementById('coverCropResize');
    var aspectRatio=1280/350; // ~3.66:1 matching cover dimensions

    function initCoverCropBox(){
        var w=Math.min(img.clientWidth,img.clientWidth*0.9);
        if(w<10){setTimeout(initCoverCropBox,50);return;}
        var h=Math.round(w/aspectRatio);
        if(h>img.clientHeight*0.9){h=Math.round(img.clientHeight*0.9);w=Math.round(h*aspectRatio);}
        box.style.width=w+'px';box.style.height=h+'px';
        box.style.left=((img.clientWidth-w)/2)+'px';box.style.top=((img.clientHeight-h)/2)+'px';
    }
    if(img.complete&&img.naturalWidth>0) setTimeout(initCoverCropBox,50);
    else img.onload=function(){setTimeout(initCoverCropBox,50);};

    var dragging=false,resizing=false,startX,startY,startL,startT,startW,startH;
    function ccDragStart(x,y,isResize){if(isResize){resizing=true;startW=box.offsetWidth;startH=box.offsetHeight;}else{dragging=true;startL=box.offsetLeft;startT=box.offsetTop;}startX=x;startY=y;}
    function ccDragMove(x,y){if(dragging){box.style.left=Math.max(0,Math.min(startL+(x-startX),img.clientWidth-box.offsetWidth))+'px';box.style.top=Math.max(0,Math.min(startT+(y-startY),img.clientHeight-box.offsetHeight))+'px';}if(resizing){var nw=Math.max(100,Math.min(startW+(x-startX),img.clientWidth-box.offsetLeft));var nh=Math.round(nw/aspectRatio);if(nh>img.clientHeight-box.offsetTop){nh=img.clientHeight-box.offsetTop;nw=Math.round(nh*aspectRatio);}box.style.width=nw+'px';box.style.height=nh+'px';}}
    function ccDragEnd(){dragging=false;resizing=false;}

    box.addEventListener('mousedown',function(e){if(e.target===resizeHandle)return;ccDragStart(e.clientX,e.clientY,false);e.preventDefault();});
    resizeHandle.addEventListener('mousedown',function(e){ccDragStart(e.clientX,e.clientY,true);e.preventDefault();e.stopPropagation();});
    document.addEventListener('mousemove',function onCoverMove(e){ccDragMove(e.clientX,e.clientY);});
    document.addEventListener('mouseup',ccDragEnd);
    box.addEventListener('touchstart',function(e){if(e.target===resizeHandle)return;var t=e.touches[0];ccDragStart(t.clientX,t.clientY,false);e.preventDefault();},{passive:false});
    resizeHandle.addEventListener('touchstart',function(e){var t=e.touches[0];ccDragStart(t.clientX,t.clientY,true);e.preventDefault();e.stopPropagation();},{passive:false});
    document.addEventListener('touchmove',function(e){if(dragging||resizing){var t=e.touches[0];ccDragMove(t.clientX,t.clientY);e.preventDefault();}},{passive:false});
    document.addEventListener('touchend',ccDragEnd);

    document.getElementById('coverCropConfirmBtn').addEventListener('click',function(){
        var canvas=document.createElement('canvas');
        var scaleX=img.naturalWidth/img.clientWidth;
        var scaleY=img.naturalHeight/img.clientHeight;
        var sx=box.offsetLeft*scaleX,sy=box.offsetTop*scaleY,sw=box.offsetWidth*scaleX,sh=box.offsetHeight*scaleY;
        canvas.width=1280;canvas.height=350;
        var ctx=canvas.getContext('2d');
        ctx.drawImage(img,sx,sy,sw,sh,0,0,1280,350);
        var dataUrl=canvas.toDataURL('image/jpeg',0.9);
        // Upload cover photo to Supabase
        if(currentUser){
            canvas.toBlob(function(blob){
                var coverFile=new File([blob],'cover.jpg',{type:'image/jpeg'});
                sbUploadCover(currentUser.id,coverFile).then(function(publicUrl){
                    return sbUpdateProfile(currentUser.id,{cover_photo_url:publicUrl}).then(function(){
                        state.coverPhoto=publicUrl;
                        state.photos.cover.unshift({src:publicUrl,date:Date.now()});
                        renderPhotosCard();
                        applyCoverPhoto();
                    });
                }).catch(function(e){
                    console.error('Cover upload error:',e);
                    state.coverPhoto=dataUrl;
                    state.photos.cover.unshift({src:dataUrl,date:Date.now()});
                    renderPhotosCard();
                    applyCoverPhoto();
                });
            },'image/jpeg',0.9);
        } else {
            state.coverPhoto=dataUrl;
            state.photos.cover.unshift({src:dataUrl,date:Date.now()});
            renderPhotosCard();
            applyCoverPhoto();
        }
        closeModal();
    });
}
function applyCoverPhoto(){
    if(state.coverPhoto){
        $('#timelineCover').style.backgroundImage='url('+state.coverPhoto+')';
        var btn=$('#coverEditBtn');
        if(btn) btn.innerHTML='<i class="fas fa-camera"></i> Change Cover Photo';
    }
}

// View Profile links
$('#viewMyProfile').addEventListener('click',function(e){e.preventDefault();showMyProfileModal();});
$('#dropdownViewProfile').addEventListener('click',function(e){e.preventDefault();$('#userDropdownMenu').classList.remove('show');showMyProfileModal();});

// Edit Profile
$('#editProfileBtn').addEventListener('click',function(e){
    e.preventDefault();
    // Read current values from Supabase profile (authoritative) or DOM fallback
    var name=currentUser?currentUser.display_name||currentUser.username:'';
    var statusText=currentUser?currentUser.status||'':'';
    var bio=currentUser?currentUser.bio||'':'';
    var html='<div class="modal-header"><h3>Edit Profile</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body"><form class="edit-profile-form" id="editProfileForm">';
    html+='<label>Name</label><input type="text" id="editName" value="'+name+'">';
    var statusEmojis=['😊','😎','🤩','😴','😤','🥳','🤔','😂','❤️','🔥','💀','👻','🎮','📚','💻','🎵','✨','🌙'];
    html+='<label>Status</label><div class="status-emoji-picker" id="statusEmojiPicker">';
    statusEmojis.forEach(function(em){html+='<button type="button" class="status-emoji-btn'+(statusText===em?' active':'')+'" data-emoji="'+em+'">'+em+'</button>';});
    html+='<button type="button" class="status-emoji-btn'+(statusText===''?' active':'')+'" data-emoji="" title="Clear">✖</button>';
    html+='</div><input type="hidden" id="editStatus" value="'+statusText+'">';
    html+='<label>Bio</label><textarea id="editAbout" placeholder="Tell us about yourself...">'+bio+'</textarea>';
    html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);margin-top:4px;"><div><label style="margin-bottom:0;"><i class="fas fa-lock" style="margin-right:6px;color:var(--gray);"></i>Private Followers</label><p style="font-size:12px;color:var(--gray);margin-top:2px;">Hide your followers and following lists</p></div><label class="toggle-switch"><input type="checkbox" id="editPrivate" '+(state.privateFollowers?'checked':'')+'><span class="toggle-slider"></span></label></div>';
    html+='<button type="submit" class="btn btn-primary btn-block" style="margin-top:12px;">Save</button></form></div>';
    showModal(html);
    $$('.status-emoji-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            $$('.status-emoji-btn').forEach(function(b){b.classList.remove('active');});
            btn.classList.add('active');
            document.getElementById('editStatus').value=btn.dataset.emoji;
        });
    });
    $('#editProfileForm').addEventListener('submit', async function(ev){
        ev.preventDefault();
        var n=$('#editName').value.trim()||name;
        var s=$('#editStatus').value.trim();
        var a=$('#editAbout').value.trim();
        state.privateFollowers=$('#editPrivate').checked;

        // Save to Supabase
        if(currentUser) {
            try {
                await sbUpdateProfile(currentUser.id, {
                    display_name: n,
                    status: s,
                    bio: a
                });
                currentUser.display_name = n;
                currentUser.status = s;
                currentUser.bio = a;
            } catch(e) { console.error('Profile update:', e); showToast('Failed to save profile'); return; }
        }

        $$('.profile-name').forEach(function(el){el.textContent=n;});
        var pt=$('.profile-title'); if(pt) pt.textContent=s;
        var pa=$('.profile-about'); if(pa) pa.textContent=a;
        var nu=$('.nav-username'); if(nu) nu.textContent=n;
        updateStatClickable();
        closeModal();
        showToast('Profile updated!');
    });
});

// Followers / Following modals
async function showFollowListModal(title,list,isFollowingList){
    // Build a set of who follows the current user (for relationship badges)
    var followsMe={};
    if(currentUser){
        try{
            var myFollowers=await sbGetFollowers(currentUser.id);
            myFollowers.forEach(function(f){if(f&&f.id)followsMe[f.id]=true;});
        }catch(e){console.warn('Could not load my followers for badges:',e);}
    }
    var html='<div class="modal-header"><h3>'+title+'</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
    var filtered=list.filter(function(p){return p&&p.id;});
    if(!filtered.length){html+='<p style="text-align:center;color:var(--gray);">No one yet.</p>';}
    else{
        html+='<div class="follow-list">';
        filtered.forEach(function(p){
            var name=p.display_name||p.name||p.username||'User';
            var avatar=p.avatar_url||DEFAULT_AVATAR;
            var followed=!!state.followedUsers[p.id];
            var followsYou=!!followsMe[p.id];
            var isSelf=currentUser&&p.id===currentUser.id;
            // Relationship badge
            var badge='';
            if(!isSelf){
                if(followed&&followsYou) badge='<span class="fl-badge fl-mutual" title="Mutual">🤝 Mutual</span>';
                else if(followsYou&&!followed) badge='<span class="fl-badge fl-follows-you" title="Follows you">👀 Follows you</span>';
                else if(followed&&!followsYou) badge='<span class="fl-badge fl-you-follow" title="You follow">💜 You follow</span>';
            }
            html+='<div class="follow-list-item fl-clickable" data-uid="'+p.id+'">';
            html+='<img src="'+avatar+'" alt="'+name+'" class="fl-avatar">';
            html+='<div class="follow-list-info"><h4 class="fl-name">'+name+'</h4>'+badge+'</div>';
            if(!isSelf) html+='<button class="btn follow-btn-small '+(followed?'btn-disabled':'btn-green')+' fl-follow-btn" data-uid="'+p.id+'">'+(followed?'<i class="fas fa-check"></i>':'<i class="fas fa-plus"></i>')+'</button>';
            html+='</div>';
        });
        html+='</div>';
    }
    html+='</div>';
    showModal(html);
    // Click avatar or name to open profile
    $$('.fl-clickable').forEach(function(item){
        var avatar=item.querySelector('.fl-avatar');
        var nameEl=item.querySelector('.fl-name');
        function openProfile(e){
            e.stopPropagation();
            var uid=item.getAttribute('data-uid');
            if(!uid)return;
            closeModal();
            sbGetProfile(uid).then(function(p){if(p)showProfileView(profileToPerson(p));}).catch(function(e){console.error(e);});
        }
        if(avatar){avatar.style.cursor='pointer';avatar.addEventListener('click',openProfile);}
        if(nameEl){nameEl.style.cursor='pointer';nameEl.addEventListener('click',openProfile);}
    });
    $$('.fl-follow-btn').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();toggleFollow(btn.dataset.uid,btn);});});
}
$('#followingStat').addEventListener('click',async function(){
    if(!currentUser)return;
    try{var list=await sbGetFollowing(currentUser.id);showFollowListModal('Following',list,true);}catch(e){console.error(e);}
});
$('#followersStat').addEventListener('click',async function(){
    if(!currentUser)return;
    try{var list=await sbGetFollowers(currentUser.id);showFollowListModal('Followers',list,false);}catch(e){console.error(e);}
});

// Avatar photo upload with selection modal
$('#avatarEditBtn').addEventListener('click',function(e){
    e.stopPropagation();
    var photos=state.photos.profile;
    var html='<div class="modal-header"><h3>Change Profile Picture</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
    html+='<div style="text-align:center;margin-bottom:16px;"><button class="btn btn-primary" id="avatarUploadNewBtn"><i class="fas fa-upload"></i> Upload New Photo</button></div>';
    if(photos.length>0){
        html+='<p style="font-size:13px;color:var(--gray);margin-bottom:12px;text-align:center;">Or select from previous uploads:</p>';
        html+='<div class="shop-scroll-row" id="avatarPickRow" style="gap:12px;padding:8px 4px 12px;">';
        photos.forEach(function(p,i){
            html+='<img src="'+p.src+'" class="avatar-pick-thumb" data-idx="'+i+'" style="min-width:80px;max-width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:3px solid transparent;transition:border-color .2s;flex-shrink:0;scroll-snap-align:start;">';
        });
        html+='</div>';
    }
    html+='</div>';
    showModal(html);
    if(photos.length>0) initDragScroll('#modalContent');
    document.getElementById('avatarUploadNewBtn').addEventListener('click',function(){closeModal();$('#avatarFileInput').click();});
    $$('.avatar-pick-thumb').forEach(function(thumb){
        thumb.addEventListener('mouseenter',function(){thumb.style.borderColor='var(--primary)';});
        thumb.addEventListener('mouseleave',function(){thumb.style.borderColor='transparent';});
        thumb.addEventListener('click',function(){
            var src=photos[parseInt(thumb.dataset.idx)].src;
            syncAllAvatars(src);
            if(currentUser) sbUpdateProfile(currentUser.id, { avatar_url: src }).catch(function(e){ console.error('Avatar select error:', e); });
            closeModal();
        });
    });
});
$('#avatarFileInput').addEventListener('change', function(){
    var file=this.files[0];
    if(!file) return;
    var isGif=file.type==='image/gif';
    if(isGif){
        // GIFs: upload directly without cropping
        if(currentUser){
            sbUploadAvatar(currentUser.id, file).then(function(publicUrl){
                return sbUpdateProfile(currentUser.id, { avatar_url: publicUrl }).then(function(){
                    syncAllAvatars(publicUrl);
                    state.photos.profile.unshift({src:publicUrl,date:Date.now()});
                    renderPhotosCard();
                });
            }).catch(function(e){console.error('Avatar upload error:', e);});
        } else {
            var reader=new FileReader();
            reader.onload=function(e){syncAllAvatars(e.target.result);state.photos.profile.unshift({src:e.target.result,date:Date.now()});renderPhotosCard();};
            reader.readAsDataURL(file);
        }
    } else {
        // Non-GIFs: show crop modal first
        var reader=new FileReader();
        reader.onload=function(e){ showCropModal(e.target.result); };
        reader.readAsDataURL(file);
    }
});

function showCropModal(src){
    var html='<div class="modal-header"><h3>Crop Photo</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body" style="text-align:center;"><div class="crop-container" id="cropContainer"><img src="'+src+'" id="cropImg"><div class="crop-box" id="cropBox"><div class="crop-resize" id="cropResize"></div></div></div>';
    html+='<div style="margin-top:16px;"><button class="btn btn-primary" id="cropConfirmBtn">Apply</button></div></div>';
    showModal(html);

    var img=document.getElementById('cropImg');
    var box=document.getElementById('cropBox');
    var container=document.getElementById('cropContainer');
    var resizeHandle=document.getElementById('cropResize');

    function initCropBox(){
        var size=Math.min(img.clientWidth,img.clientHeight,200);
        if(size<10){setTimeout(initCropBox,50);return;} // wait for layout
        box.style.width=size+'px';box.style.height=size+'px';
        box.style.left=((img.clientWidth-size)/2)+'px';box.style.top=((img.clientHeight-size)/2)+'px';
    }
    if(img.complete&&img.naturalWidth>0) setTimeout(initCropBox,50);
    else img.onload=function(){setTimeout(initCropBox,50);};

    var dragging=false,resizing=false,startX,startY,startL,startT,startW,startH;

    function onDragStart(x,y,isResize){if(isResize){resizing=true;startW=box.offsetWidth;startH=box.offsetHeight;}else{dragging=true;startL=box.offsetLeft;startT=box.offsetTop;}startX=x;startY=y;}
    function onDragMove(x,y){if(dragging){box.style.left=Math.max(0,Math.min(startL+(x-startX),img.clientWidth-box.offsetWidth))+'px';box.style.top=Math.max(0,Math.min(startT+(y-startY),img.clientHeight-box.offsetHeight))+'px';}if(resizing){var d=Math.max(x-startX,y-startY);var ns=Math.max(40,Math.min(startW+d,img.clientWidth-box.offsetLeft,img.clientHeight-box.offsetTop));box.style.width=ns+'px';box.style.height=ns+'px';}}
    function onDragEnd(){dragging=false;resizing=false;}

    box.addEventListener('mousedown',function(e){if(e.target===resizeHandle)return;onDragStart(e.clientX,e.clientY,false);e.preventDefault();});
    resizeHandle.addEventListener('mousedown',function(e){onDragStart(e.clientX,e.clientY,true);e.preventDefault();e.stopPropagation();});
    document.addEventListener('mousemove',function onMove(e){onDragMove(e.clientX,e.clientY);});
    document.addEventListener('mouseup',onDragEnd);
    box.addEventListener('touchstart',function(e){if(e.target===resizeHandle)return;var t=e.touches[0];onDragStart(t.clientX,t.clientY,false);e.preventDefault();},{passive:false});
    resizeHandle.addEventListener('touchstart',function(e){var t=e.touches[0];onDragStart(t.clientX,t.clientY,true);e.preventDefault();e.stopPropagation();},{passive:false});
    document.addEventListener('touchmove',function(e){if(dragging||resizing){var t=e.touches[0];onDragMove(t.clientX,t.clientY);e.preventDefault();}},{passive:false});
    document.addEventListener('touchend',onDragEnd);

    document.getElementById('cropConfirmBtn').addEventListener('click',function(){
        var canvas=document.createElement('canvas');
        var scaleX=img.naturalWidth/img.clientWidth;
        var scaleY=img.naturalHeight/img.clientHeight;
        var sx=box.offsetLeft*scaleX,sy=box.offsetTop*scaleY,sw=box.offsetWidth*scaleX,sh=box.offsetHeight*scaleY;
        canvas.width=400;canvas.height=400;
        var ctx=canvas.getContext('2d');
        ctx.drawImage(img,sx,sy,sw,sh,0,0,400,400);
        var dataUrl=canvas.toDataURL('image/png');
        // Upload cropped image to Supabase
        if(currentUser){
            canvas.toBlob(function(blob){
                var croppedFile=new File([blob],'avatar.png',{type:'image/png'});
                sbUploadAvatar(currentUser.id,croppedFile).then(function(publicUrl){
                    return sbUpdateProfile(currentUser.id,{avatar_url:publicUrl}).then(function(){
                        syncAllAvatars(publicUrl);
                        state.photos.profile.unshift({src:publicUrl,date:Date.now()});
                        renderPhotosCard();
                    });
                }).catch(function(e){
                    console.error('Avatar upload error:',e);
                    // Fallback: use local data URL
                    syncAllAvatars(dataUrl);
                    state.photos.profile.unshift({src:dataUrl,date:Date.now()});
                    renderPhotosCard();
                });
            },'image/png');
        } else {
            syncAllAvatars(dataUrl);
            state.photos.profile.unshift({src:dataUrl,date:Date.now()});
            renderPhotosCard();
        }
        closeModal();
    });
}

// Settings & dropdown handlers
function settingsToggle(key){return '<label style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;"><span style="font-size:14px;">'+{darkMode:'Dark Mode',notifSound:'Notification Sounds',privateProfile:'Private Profile',autoplay:'Autoplay Videos'}[key]+'</span><span class="stoggle" data-key="'+key+'" style="width:42px;height:24px;border-radius:12px;background:'+(settings[key]?'var(--green)':'#ccc')+';position:relative;display:inline-block;transition:background .2s;"><span style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;'+(settings[key]?'left:20px':'left:2px')+';transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);"></span></span></label>';}
document.addEventListener('click',function(e){
    var a=e.target.closest('.user-dropdown a');
    if(a){
        var text=a.textContent.trim();
        if(text==='Settings'){
            e.preventDefault();
            $('#userDropdownMenu').classList.remove('show');
            var h='<div class="modal-header"><h3>Settings</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body">';
            h+=settingsToggle('darkMode')+settingsToggle('notifSound')+settingsToggle('privateProfile')+settingsToggle('autoplay');
            h+='<label style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:14px;">Comment Order</span><select id="commentOrderSelect" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:#fff;color:var(--dark);cursor:pointer;"><option value="top"'+(settings.commentOrder==='top'?' selected':'')+'>Top</option><option value="newest"'+(settings.commentOrder==='newest'?' selected':'')+'>Newest</option><option value="oldest"'+(settings.commentOrder==='oldest'?' selected':'')+'>Oldest</option></select></label>';
            var hiddenCount=Object.keys(hiddenPosts).length;
            h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:14px;">Hidden Posts</span><button class="btn btn-outline" id="settingsViewHidden" style="padding:4px 14px;font-size:12px;">View ('+hiddenCount+')</button></div>';
            var blockedCount=Object.keys(blockedUsers).length;
            h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:14px;">Blocked Users</span><button class="btn btn-outline" id="settingsViewBlocked" style="padding:4px 14px;font-size:12px;color:#e74c3c;border-color:#e74c3c;">View ('+blockedCount+')</button></div>';
            h+='<div style="margin-top:16px;text-align:center;"><button class="btn btn-primary modal-close">Done</button></div></div>';
            showModal(h);
            document.getElementById('settingsViewHidden').addEventListener('click',function(){showHiddenPostsModal();});
            document.getElementById('settingsViewBlocked').addEventListener('click',function(){showBlockedUsersModal();});
            document.getElementById('commentOrderSelect').addEventListener('change',function(){settings.commentOrder=this.value;saveState();});
            $$('.stoggle').forEach(function(t){t.style.cursor='pointer';t.addEventListener('click',function(){
                var k=t.dataset.key;settings[k]=!settings[k];
                t.style.background=settings[k]?'var(--green)':'#ccc';
                t.firstElementChild.style.left=settings[k]?'20px':'2px';
                if(k==='darkMode'){document.body.style.background=settings[k]?'#1a1a2e':'';document.body.style.color=settings[k]?'#eee':'';}
                saveState();
            });});
        }
        if(text==='Logout'){
            e.preventDefault();
            $('#userDropdownMenu').classList.remove('show');
            showModal('<div class="modal-header"><h3>Logout</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body"><p style="color:#777;text-align:center;margin-bottom:16px;">Are you sure you want to logout?</p><div class="modal-actions"><button class="btn btn-primary modal-close">Stay</button><button class="btn btn-outline" id="logoutConfirm">Logout</button></div></div>');
            document.getElementById('logoutConfirm').addEventListener('click',function(){closeModal();handleLogout();});
        }
    }
});

// ======================== GENERATE FEED (100 POSTS) ========================
var feedPosts=[];
var activeFeedTab='following';
async function generatePosts(){
    feedPosts=[];
    try {
        var posts;
        if(activeFeedTab==='following' && currentUser){
            posts = await sbGetFollowingFeed(currentUser.id, 50);
        }
        // If following tab returned nothing, also try all posts
        if(!posts||!posts.length){
            posts = await sbGetFeed(50);
        }
        // Fetch shared post data in batch
        var sharedIds=[];
        posts.forEach(function(p){if(p.shared_post_id)sharedIds.push(p.shared_post_id);});
        var sharedMap={};
        if(sharedIds.length){
            try{
                var sharedPosts=await sbGetPostsByIds(sharedIds);
                sharedPosts.forEach(function(sp){sharedMap[sp.id]=sp;});
            }catch(e){console.warn('Could not load shared posts:',e);}
        }
        posts.forEach(function(p,i){
            if(!p||!p.author) return; // skip posts with missing author data
            var fp={
                idx: p.id,
                person: {
                    id: p.author.id,
                    name: p.author.display_name || p.author.username || 'User',
                    img: null,
                    avatar_url: p.author.avatar_url
                },
                text: p.content || '',
                tags: [],
                badge: badgeTypes[i % badgeTypes.length],
                loc: locations[i % locations.length],
                likes: p.like_count || 0,
                comments: [],
                commentCount: (p.comments && p.comments[0]) ? p.comments[0].count : 0,
                shares: 0,
                images: p.image_url ? [p.image_url] : null,
                created_at: p.created_at
            };
            if(p.shared_post_id&&sharedMap[p.shared_post_id]){
                var sp=sharedMap[p.shared_post_id];
                fp.sharedPost={
                    name:sp.author?(sp.author.display_name||sp.author.username):'User',
                    avatar_url:sp.author?sp.author.avatar_url:null,
                    text:sp.content||'',
                    time:timeAgoReal(sp.created_at),
                    images:sp.image_url?[sp.image_url]:null
                };
                fp.badge={cls:'badge-green',icon:'fa-share',text:'Shared'};
            }
            feedPosts.push(fp);
        });
    } catch(e) {
        console.error('generatePosts error:', e);
        showToast('Feed error: ' + (e.message || 'Could not load posts'));
    }
    renderFeed(activeFeedTab);
}
function getFollowingIds(){
    var ids={};
    if(currentUser) ids[currentUser.id]=true; // include own posts
    Object.keys(state.followedUsers).forEach(function(k){ids[k]=true;});
    groups.forEach(function(g){if(state.joinedGroups[g.id]&&g.memberIds){g.memberIds.forEach(function(id){ids[id]=true;});}});
    return ids;
}
function renderFeed(tab){
    activeFeedTab=tab;
    var posts;
    if(tab==='following'){
        var ids=getFollowingIds();
        posts=feedPosts.filter(function(p){return ids[p.person.id]&&!hiddenPosts[p.idx]&&!blockedUsers[p.person.id];});
    } else {
        posts=feedPosts.filter(function(p){return !hiddenPosts[p.idx]&&!blockedUsers[p.person.id];}).sort(function(a,b){return b.likes-a.likes;});
    }
    var container=$('#feedContainer');
    if(!posts.length){
        container.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--gray);"><i class="fas fa-pen" style="font-size:32px;margin-bottom:12px;display:block;"></i><p>No posts yet. Be the first to post!</p></div>';
        return;
    }
    var html='';
    posts.forEach(function(p){
        var i=p.idx,person=p.person,text=p.text,tags=p.tags||[],badge=p.badge,loc=p.loc,likes=p.likes,genComments=p.comments||[],shares=p.shares;
        var commentCount=p.commentCount||genComments.length;
        var menuId='post-menu-'+i;
        var short=text.substring(0,Math.min(160,text.length));var rest=text.substring(160);var hasMore=rest.length>0;
        var avatarSrc=person.avatar_url||'images/default-avatar.svg';
        var timeStr=p.created_at?timeAgoReal(p.created_at):timeAgo(typeof i==='number'?i:0);
        html+='<div class="card feed-post">';
        html+='<div class="post-header">';
        html+='<img src="'+avatarSrc+'" alt="'+person.name+'" class="post-avatar" data-person-id="'+person.id+'">';
        html+='<div class="post-user-info"><div class="post-user-top"><h4 class="post-username" data-person-id="'+person.id+'">'+person.name+'</h4><span class="post-time">'+timeStr+'</span></div>';
        html+='<div class="post-badges"><span class="badge '+badge.cls+'"><i class="fas '+badge.icon+'"></i> '+badge.text+'</span><span class="badge badge-blue"><i class="fas fa-map-marker-alt"></i> '+loc+'</span></div></div>';
        html+='<button class="post-menu-btn" data-menu="'+menuId+'"><i class="fas fa-ellipsis-h"></i></button>';
        html+='<div class="post-dropdown" id="'+menuId+'"><a href="#" data-action="save" data-pid="'+i+'"><i class="fas fa-bookmark"></i> Save Post</a><a href="#" data-action="report" data-pid="'+i+'"><i class="fas fa-flag"></i> Report</a><a href="#" data-action="hide" data-pid="'+i+'"><i class="fas fa-eye-slash"></i> Hide</a></div>';
        html+='</div>';
        html+='<div class="post-description"><p>'+short+(hasMore?'<span class="view-more-text hidden">'+rest+'</span>':'')+'</p>'+(hasMore?'<button class="view-more-btn">view more</button>':'')+'</div>';
        html+='<div class="post-tags">';
        tags.forEach(function(t){html+='<span class="skill-tag">'+t+'</span>';});
        html+='</div>';
        if(p.images){var imgs=p.images;html+='<div class="post-media-grid pm-count-'+imgs.length+'">';imgs.forEach(function(src){html+='<div class="pm-thumb"><img src="'+src+'" alt="Post photo"></div>';});html+='</div>';}
        if(p.sharedPost){
            var sp=p.sharedPost;var spAvatar=sp.avatar_url||DEFAULT_AVATAR;
            html+='<div class="share-preview" style="margin:0 20px 14px;">';
            html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><img src="'+spAvatar+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;"><strong class="share-preview-name" style="font-size:13px;">'+sp.name+'</strong><span class="share-preview-time" style="font-size:12px;">'+sp.time+'</span></div>';
            html+='<div class="share-preview-text" style="font-size:13px;">'+sp.text+'</div>';
            if(sp.images){sp.images.forEach(function(src){html+='<img src="'+src+'" style="max-width:100%;border-radius:8px;margin-top:8px;">';});}
            html+='</div>';
        }
        html+='<div class="post-actions"><div class="action-left">';
        html+='<button class="action-btn like-btn'+(state.likedPosts[i]?' liked':'')+'" data-post-id="'+i+'"><i class="'+(state.likedPosts[i]?'fas':'far')+' fa-thumbs-up"></i><span class="like-count">'+likes+'</span></button>';
        html+='<button class="action-btn dislike-btn" data-post-id="'+i+'"><i class="'+(state.dislikedPosts[i]?'fas':'far')+' fa-thumbs-down"></i><span class="dislike-count">0</span></button>';
        html+='<button class="action-btn comment-btn"><i class="far fa-comment"></i><span>'+commentCount+'</span></button>';
        html+='<button class="action-btn share-btn"><i class="fas fa-share-from-square"></i><span>'+shares+'</span></button>';
        html+='</div><div class="action-right"><div class="liked-avatars" data-post-id="'+i+'"></div></div></div>';
        html+='<div class="post-comments" data-post-id="'+i+'"></div>';
        html+='</div>';
    });
    container.innerHTML=html;
    bindPostEvents();
    posts.forEach(function(p){renderInlineComments(p.idx);});
    // Load liker avatars asynchronously for Supabase posts
    posts.forEach(function(p){
        if(/^[0-9a-f]{8}-/.test(p.idx)){
            sbGetLikers('post',p.idx,3).then(function(likers){
                var avatarEl=container.querySelector('.liked-avatars[data-post-id="'+p.idx+'"]');
                if(avatarEl&&likers&&likers.length){
                    var h='';
                    likers.forEach(function(l){h+='<img src="'+(l.avatar_url||DEFAULT_AVATAR)+'" alt="'+(l.display_name||l.username||'User')+'" style="object-fit:cover;">';});
                    avatarEl.innerHTML=h;
                }
            }).catch(function(){});
        }
    });
    // Update tab active state
    $$('#feedTabs .search-tab').forEach(function(t){t.classList.toggle('active',t.dataset.feedtab===tab);});
}
// Feed tab clicks
document.getElementById('feedTabs').addEventListener('click',function(e){
    var tab=e.target.closest('[data-feedtab]');
    if(tab&&tab.dataset.feedtab!==activeFeedTab) {
        activeFeedTab=tab.dataset.feedtab;
        generatePosts();
    }
});

function bindPostEvents(){
    var _fc=document.getElementById('feedContainer');
    function _$$(sel){return Array.from(_fc.querySelectorAll(sel));}
    // Like buttons (Supabase-backed for UUID post IDs, local for legacy numeric IDs)
    _$$('.like-btn').forEach(function(btn){
        btn.addEventListener('click', async function(e){
            if(e.target.classList.contains('like-count')) return;
            var postId=btn.getAttribute('data-post-id');
            var countEl=btn.querySelector('.like-count');
            var count=parseInt(countEl.textContent);
            var had=!!(state.likedPosts[postId]||state.dislikedPosts[postId]);

            // If this is a UUID (Supabase post), call Supabase toggle
            var isUUID = /^[0-9a-f]{8}-/.test(postId);
            if(isUUID && currentUser) {
                // Clear dislike if active
                if(state.dislikedPosts[postId]){
                    var db=btn.closest('.action-left').querySelector('.dislike-btn');
                    if(db){var dc=db.querySelector('.dislike-count');dc.textContent=Math.max(0,parseInt(dc.textContent)-1);db.classList.remove('disliked');db.querySelector('i').className='far fa-thumbs-down';}
                    delete state.dislikedPosts[postId];
                }
                try {
                    var nowLiked = await sbToggleLike(currentUser.id, 'post', postId);
                    if(nowLiked) {
                        state.likedPosts[postId]=true;
                        btn.classList.add('liked');
                        btn.querySelector('i').className='fas fa-thumbs-up';
                        countEl.textContent=count+1;
                    } else {
                        delete state.likedPosts[postId];
                        btn.classList.remove('liked');
                        btn.querySelector('i').className='far fa-thumbs-up';
                        countEl.textContent=Math.max(0,count-1);
                    }
                } catch(err) { console.error('Like error:', err); }
            } else {
                // Legacy local like
                if(state.likedPosts[postId]){
                    delete state.likedPosts[postId];
                    btn.classList.remove('liked');
                    btn.querySelector('i').className='far fa-thumbs-up';
                    countEl.textContent=count-1;
                } else {
                    if(state.dislikedPosts[postId]){var db=btn.closest('.action-left').querySelector('.dislike-btn');var dc=db.querySelector('.dislike-count');dc.textContent=parseInt(dc.textContent)-1;delete state.dislikedPosts[postId];db.classList.remove('disliked');db.querySelector('i').className='far fa-thumbs-down';}
                    state.likedPosts[postId]=true;
                    btn.classList.add('liked');
                    btn.querySelector('i').className='fas fa-thumbs-up';
                    countEl.textContent=count+1;
                }
            }
            var has=!!(state.likedPosts[postId]||state.dislikedPosts[postId]);
            if(!had&&has){state.coins++;updateCoins();}else if(had&&!has){state.coins--;updateCoins();}
        });
    });

    // Dislike buttons
    _$$('.dislike-btn').forEach(function(btn){
        btn.addEventListener('click', async function(){
            var postId=btn.getAttribute('data-post-id');
            var countEl=btn.querySelector('.dislike-count');
            var count=parseInt(countEl.textContent);
            var had=!!(state.likedPosts[postId]||state.dislikedPosts[postId]);
            if(state.dislikedPosts[postId]){
                delete state.dislikedPosts[postId];
                btn.classList.remove('disliked');
                btn.querySelector('i').className='far fa-thumbs-down';
                countEl.textContent=count-1;
            } else {
                // Clear like if active
                if(state.likedPosts[postId]){
                    var lb=btn.closest('.action-left').querySelector('.like-btn');var lc=lb.querySelector('.like-count');lc.textContent=Math.max(0,parseInt(lc.textContent)-1);delete state.likedPosts[postId];lb.classList.remove('liked');lb.querySelector('i').className='far fa-thumbs-up';
                    // Remove Supabase like
                    var isUUID=/^[0-9a-f]{8}-/.test(postId);
                    if(isUUID&&currentUser){try{await sbToggleLike(currentUser.id,'post',postId);}catch(e){}}
                }
                state.dislikedPosts[postId]=true;
                btn.classList.add('disliked');
                btn.querySelector('i').className='fas fa-thumbs-down';
                countEl.textContent=count+1;
            }
            var has=!!(state.likedPosts[postId]||state.dislikedPosts[postId]);
            if(!had&&has){state.coins++;updateCoins();}else if(had&&!has){state.coins--;updateCoins();}
        });
    });

    // View more
    _$$('.view-more-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            var span=btn.parentElement.querySelector('.view-more-text');
            if(span.classList.contains('hidden')){span.classList.remove('hidden');btn.textContent='view less';}
            else{span.classList.add('hidden');btn.textContent='view more';}
        });
    });

    // Post menus
    _$$('.post-menu-btn').forEach(function(btn){
        btn.addEventListener('click',function(e){
            e.stopPropagation();
            var menuId=btn.getAttribute('data-menu');
            var menu=document.getElementById(menuId);
            _$$('.post-dropdown.show').forEach(function(m){if(m!==menu)m.classList.remove('show');});
            menu.classList.toggle('show');
        });
    });

    // Post menu actions
    _$$('.post-dropdown a').forEach(function(a){
        a.addEventListener('click',function(e){
            e.preventDefault();
            a.closest('.post-dropdown').classList.remove('show');
            var pid=a.dataset.pid;
            var action=a.dataset.action;
            if(action==='save') showSaveModal(pid);
            else if(action==='report') showReportModal(pid);
            else if(action==='hide') hidePost(pid);
        });
    });

    // Click username/avatar to view profile
    _$$('.post-username, .post-avatar').forEach(function(el){
        el.addEventListener('click',async function(){
            var uid=el.getAttribute('data-person-id');
            if(!uid) return;
            try{var p=await sbGetProfile(uid);if(p)showProfileView(profileToPerson(p));}catch(e){}
        });
    });

    // Comment buttons
    _$$('.comment-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            var postId=btn.closest('.action-left').querySelector('.like-btn').getAttribute('data-post-id');
            showComments(postId,btn.querySelector('span'));
        });
    });

    // Share buttons
    _$$('.share-btn').forEach(function(btn){btn.addEventListener('click',function(){handleShare(btn);});});

    // Tag clicks
    _$$('.skill-tag').forEach(function(tag){
        tag.addEventListener('click',function(){
            showModal('<div class="modal-header"><h3>'+tag.textContent+'</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body"><p style="text-align:center;color:#777;">Showing all posts tagged with '+tag.textContent+'</p></div>');
        });
    });

    // Like count click to show likers
    bindLikeCountClicks('#feedContainer');
}

async function showLikersModal(postId){
    var isUUID=/^[0-9a-f]{8}-/.test(postId);
    var likers=[];
    if(isUUID){
        try{likers=await sbGetLikers('post',postId,50);}catch(e){console.error('Load likers:',e);}
    }
    if(!likers||likers.length===0){
        showModal('<div class="modal-header"><h3><i class="fas fa-thumbs-up" style="color:var(--primary);margin-right:8px;"></i>Liked by</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body"><p style="color:#777;text-align:center;">No likes yet.</p></div>');
        return;
    }
    var h='<div class="modal-header"><h3><i class="fas fa-thumbs-up" style="color:var(--primary);margin-right:8px;"></i>Liked by</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body"><ul class="follow-list" style="max-height:400px;overflow-y:auto;">';
    likers.forEach(function(p){
        var name=p.display_name||p.username||'User';
        var avatar=p.avatar_url||DEFAULT_AVATAR;
        h+='<li class="follow-list-item"><img src="'+avatar+'" alt="'+name+'" style="object-fit:cover;"><div class="follow-list-info"><h4>'+name+'</h4></div></li>';
    });
    h+='</ul></div>';
    showModal(h);
}

function bindLikeCountClicks(containerSelector){
    var container=document.querySelector(containerSelector);
    if(!container) return;
    container.querySelectorAll('.like-count').forEach(function(el){
        el.addEventListener('click',function(e){
            e.stopPropagation();
            var postId=el.closest('.like-btn').getAttribute('data-post-id');
            showLikersModal(postId);
        });
    });
}

// ======================== POST CREATION ========================
$('#openPostModal').addEventListener('click',function(){
    var html='<div class="create-post-modal"><div class="modal-header"><h3>Create a Post</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    html+='<div class="modal-body"><div style="display:flex;align-items:center;gap:10px;padding:16px 20px 0;"><img src="'+$('#profileAvatarImg').src+'" style="width:40px;height:40px;border-radius:50%;"><strong style="font-size:14px;">'+(currentUser?(currentUser.display_name||currentUser.username):'You')+'</strong></div>';
    html+='<textarea class="cpm-textarea" id="cpmText" placeholder="Write something..."></textarea>';
    html+='<div class="cpm-media-zone" id="cpmMediaZone"><div class="cpm-media-grid" id="cpmGrid"></div><div id="cpmDropZone"><i class="fas fa-photo-video"></i><br>Add Photos/Videos</div><input type="file" accept="image/*,video/*" multiple id="cpmFileInput" style="display:none;"></div>';
    html+='<div class="cpm-tags-section"><div class="cpm-tags-wrap" id="cpmTagsWrap"></div></div>';
    html+='<div class="cpm-link-section"><div class="cpm-link-toggle" id="cpmLinkToggle"><i class="fas fa-link"></i> Add Link Preview</div><div class="cpm-link-fields" id="cpmLinkFields" style="display:none;"><input type="text" class="cpm-link-input" id="cpmLinkUrl" placeholder="URL (e.g. https://example.com)"><input type="text" class="cpm-link-input" id="cpmLinkTitle" placeholder="Title"><input type="text" class="cpm-link-input" id="cpmLinkDesc" placeholder="Description"><div class="cpm-link-img-upload" id="cpmLinkImgUpload"><i class="fas fa-image"></i> Add Preview Image</div><input type="file" accept="image/*" id="cpmLinkImgInput" style="display:none;"><img id="cpmLinkImgPreview" style="display:none;" class="cpm-link-img-preview"></div></div>';
    html+='<div class="cpm-footer"><button class="btn btn-primary" id="cpmPublish">Publish</button></div></div></div>';
    showModal(html);
    var mediaList=[];
    var linkImgSrc='';
    var zone=document.getElementById('cpmMediaZone');
    var grid=document.getElementById('cpmGrid');
    var dropZone=document.getElementById('cpmDropZone');
    var fileInput=document.getElementById('cpmFileInput');
    dropZone.addEventListener('click',function(){fileInput.click();});
    function renderGrid(){
        grid.innerHTML='';
        mediaList.forEach(function(m,i){
            var thumb=document.createElement('div');thumb.className='cpm-thumb';
            thumb.innerHTML=(m.type==='video'?'<video src="'+m.src+'" muted></video>':'<img src="'+m.src+'">')+'<button class="remove-thumb" data-idx="'+i+'"><i class="fas fa-times"></i></button>';
            grid.appendChild(thumb);
        });
        zone.classList.toggle('has-media',mediaList.length>0);
        grid.querySelectorAll('.remove-thumb').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();mediaList.splice(parseInt(btn.dataset.idx),1);renderGrid();});});
    }
    fileInput.addEventListener('change',function(){
        var files=Array.from(this.files);
        files.forEach(function(f){
            var isV=f.type.startsWith('video/');
            var r=new FileReader();
            r.onload=function(e){mediaList.push({src:e.target.result,type:isV?'video':'image'});renderGrid();};
            r.readAsDataURL(f);
        });
        this.value='';
    });
    document.getElementById('cpmLinkToggle').addEventListener('click',function(){var f=document.getElementById('cpmLinkFields');f.style.display=f.style.display==='none'?'flex':'none';});
    document.getElementById('cpmLinkImgUpload').addEventListener('click',function(){document.getElementById('cpmLinkImgInput').click();});
    document.getElementById('cpmLinkImgInput').addEventListener('change',function(){var file=this.files[0];if(!file)return;var r=new FileReader();r.onload=function(e){linkImgSrc=e.target.result;var prev=document.getElementById('cpmLinkImgPreview');prev.src=linkImgSrc;prev.style.display='block';};r.readAsDataURL(file);});
    // Hashtag system — auto-extract #tags from textarea on space/enter
    var postTags=[];
    function renderPostTags(){
        var wrap=document.getElementById('cpmTagsWrap');
        wrap.innerHTML='';
        postTags.forEach(function(t,i){
            wrap.innerHTML+='<span class="cpm-tag-chip"><span>#'+t+'</span><button class="cpm-tag-remove" data-idx="'+i+'"><i class="fas fa-times"></i></button></span>';
        });
        wrap.querySelectorAll('.cpm-tag-remove').forEach(function(btn){
            btn.addEventListener('click',function(){postTags.splice(parseInt(btn.dataset.idx),1);renderPostTags();});
        });
    }
    document.getElementById('cpmText').addEventListener('input',function(){
        var ta=this;
        var text=ta.value;
        // Match a completed hashtag (followed by space or newline)
        var match=text.match(/#([a-zA-Z0-9_]+)[\s\n]/);
        if(match && postTags.length<10){
            var tag=match[1].toLowerCase();
            if(postTags.indexOf(tag)===-1){
                postTags.push(tag);
                renderPostTags();
            }
            // Remove the #tag from the textarea text
            ta.value=text.replace('#'+match[1],'').replace(/\s{2,}/g,' ');
        }
    });
    document.getElementById('cpmPublish').addEventListener('click', async function(){
        var text=document.getElementById('cpmText').value.trim();
        var linkUrl=document.getElementById('cpmLinkUrl').value.trim();
        var linkTitle=document.getElementById('cpmLinkTitle').value.trim();
        var linkDesc=document.getElementById('cpmLinkDesc').value.trim();
        if(!text&&!mediaList.length&&!linkUrl)return;
        var container=$('#feedContainer');

        // Upload first image to Supabase Storage (if any)
        var imageUrl = null;
        if(mediaList.length > 0 && currentUser) {
            try {
                // Convert data URL to blob for upload
                var firstImg = mediaList[0];
                if(firstImg.type === 'image' && firstImg.src.startsWith('data:')) {
                    var resp = await fetch(firstImg.src);
                    var blob = await resp.blob();
                    var file = new File([blob], 'post-' + Date.now() + '.jpg', { type: blob.type });
                    imageUrl = await sbUploadPostImage(currentUser.id, file);
                }
            } catch(e) { console.error('Image upload:', e); }
        }

        // Create post in Supabase
        var fullContent = text;
        if(linkUrl) fullContent += '\n\n' + linkUrl;
        var sbPost = null;
        if(currentUser && (fullContent || imageUrl)) {
            try {
                sbPost = await sbCreatePost(currentUser.id, fullContent || '', imageUrl);
            } catch(e) {
                console.error('Create post:', e);
                showToast('Post failed to save: ' + (e.message || e.details || 'Unknown error'));
            }
        }

        var mediaHtml='';
        if(mediaList.length>0){
            var pid='pg-'+Date.now();
            var cnt=Math.min(mediaList.length,5);
            mediaHtml='<div class="post-media-grid pm-count-'+cnt+'" data-pgid="'+pid+'">';
            var shown=mediaList.slice(0,5);var extra=mediaList.length-5;
            shown.forEach(function(m,i){
                if(i===4&&extra>0){
                    mediaHtml+='<div class="pm-thumb pm-more" data-pgid="'+pid+'"><img src="'+m.src+'"><div class="pm-more-overlay">+'+extra+'</div></div>';
                } else {
                    mediaHtml+='<div class="pm-thumb">'+(m.type==='video'?'<video src="'+m.src+'" controls></video>':'<img src="'+m.src+'">')+'</div>';
                }
            });
            mediaHtml+='</div>';
            window['_media_'+pid]=mediaList;
            mediaList.forEach(function(m){if(m.type==='image')state.photos.post.unshift({src:m.src,date:Date.now()});});
            renderPhotosCard();
        }
        var linkHtml='';
        if(linkUrl){
            linkHtml='<a href="'+linkUrl+'" target="_blank" class="link-preview">';
            if(linkImgSrc){linkHtml+='<img src="'+linkImgSrc+'" class="link-preview-image">';}
            linkHtml+='<div class="link-preview-info">';
            if(linkTitle){linkHtml+='<div class="link-preview-title">'+linkTitle+'</div>';}
            linkHtml+='<div class="link-preview-url">'+linkUrl+'</div>';
            if(linkDesc){linkHtml+='<div class="link-preview-desc">'+linkDesc+'</div>';}
            linkHtml+='</div></a>';
        }
        var myName = currentUser ? (currentUser.display_name || currentUser.username) : 'You';
        var myPostId = sbPost ? sbPost.id : 'my-'+Date.now();
        var myUid=currentUser?currentUser.id:'';
        var postHtml='<div class="card feed-post"><div class="post-header"><img src="'+getMyAvatar()+'" alt="You" class="post-avatar" data-person-id="'+myUid+'">';
        postHtml+='<div class="post-user-info"><div class="post-user-top"><h4 class="post-username" data-person-id="'+myUid+'">'+myName+'</h4><span class="post-time">just now</span></div>';
        postHtml+='<div class="post-badges"><span class="badge badge-green"><i class="fas fa-user"></i> You</span></div></div></div>';
        var tagsHtml='';
        if(postTags.length>0){tagsHtml='<div class="post-tags">';postTags.forEach(function(t){tagsHtml+='<span class="skill-tag">#'+t+'</span>';});tagsHtml+='</div>';}
        postHtml+='<div class="post-description">'+(text?'<p>'+text.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p>':'')+mediaHtml+linkHtml+'</div>'+tagsHtml;
        postHtml+='<div class="post-actions"><div class="action-left"><button class="action-btn like-btn" data-post-id="'+myPostId+'"><i class="far fa-thumbs-up"></i><span class="like-count">0</span></button>';
        postHtml+='<button class="action-btn dislike-btn" data-post-id="'+myPostId+'"><i class="far fa-thumbs-down"></i><span class="dislike-count">0</span></button>';
        postHtml+='<button class="action-btn comment-btn"><i class="far fa-comment"></i><span>0</span></button>';
        postHtml+='<button class="action-btn share-btn"><i class="fas fa-share-from-square"></i><span>0</span></button></div></div></div>';
        container.insertAdjacentHTML('afterbegin',postHtml);
        if(state.postCoinCount<10){state.coins+=5;state.postCoinCount++;updateCoins();}
        closeModal();
        var newPost=container.firstElementChild;
        var likeBtn=newPost.querySelector('.like-btn');
        likeBtn.addEventListener('click',async function(){var countEl=likeBtn.querySelector('.like-count');var count=parseInt(countEl.textContent);var pid=likeBtn.getAttribute('data-post-id');var isUUID=/^[0-9a-f]{8}-/.test(pid);if(state.likedPosts[pid]){delete state.likedPosts[pid];likeBtn.classList.remove('liked');likeBtn.querySelector('i').className='far fa-thumbs-up';countEl.textContent=count-1;state.coins--;updateCoins();if(isUUID&&currentUser){try{await sbToggleLike(currentUser.id,'post',pid);}catch(e){}};}else{state.likedPosts[pid]=true;likeBtn.classList.add('liked');likeBtn.querySelector('i').className='fas fa-thumbs-up';countEl.textContent=count+1;state.coins++;updateCoins();if(isUUID&&currentUser){try{await sbToggleLike(currentUser.id,'post',pid);}catch(e){}}}});
        var dislikeBtn=newPost.querySelector('.dislike-btn');
        dislikeBtn.addEventListener('click',function(){var countEl=dislikeBtn.querySelector('.dislike-count');var count=parseInt(countEl.textContent);var pid=dislikeBtn.getAttribute('data-post-id');if(state.dislikedPosts[pid]){delete state.dislikedPosts[pid];dislikeBtn.classList.remove('disliked');dislikeBtn.querySelector('i').className='far fa-thumbs-down';countEl.textContent=count-1;}else{state.dislikedPosts[pid]=true;dislikeBtn.classList.add('disliked');dislikeBtn.querySelector('i').className='fas fa-thumbs-down';countEl.textContent=count+1;}});
        newPost.querySelector('.comment-btn').addEventListener('click',function(){var postId=newPost.querySelector('.like-btn').getAttribute('data-post-id');showComments(postId,newPost.querySelector('.comment-btn span'));});
        newPost.querySelector('.share-btn').addEventListener('click',function(){handleShare(newPost.querySelector('.share-btn'));});
        newPost.querySelectorAll('.post-avatar, .post-username').forEach(function(el){el.style.cursor='pointer';el.addEventListener('click',async function(){var uid=el.getAttribute('data-person-id');if(!uid)return;try{var p=await sbGetProfile(uid);if(p)showProfileView(profileToPerson(p));}catch(e){}});});
        var moreBtn=newPost.querySelector('.pm-more');
        if(moreBtn){moreBtn.addEventListener('click',function(){showAllMedia(moreBtn.dataset.pgid,4);});}
    });
});
function showAllMedia(pgid,startIdx){
    var list=window['_media_'+pgid];if(!list)return;
    var imgs=list.filter(function(m){return m.type==='image';}).map(function(m){return m.src;});
    if(imgs.length) window._openLightbox(imgs,startIdx||0);
}

// ======================== SUGGESTIONS ========================
async function renderSuggestions(){
    var list=$('#suggestionList');
    if(!list||!currentUser) return;
    try{
        var all=await sbGetAllProfiles(20);
        var suggestions=all.filter(function(p){return p.id!==currentUser.id&&!state.followedUsers[p.id];}).slice(0,5);
        if(!suggestions.length){list.innerHTML='<p style="text-align:center;color:var(--gray);font-size:13px;">No suggestions yet</p>';return;}
        var html='';
        suggestions.forEach(function(p){
            var name=p.display_name||p.username;
            var avatar=p.avatar_url||DEFAULT_AVATAR;
            html+='<div class="suggestion-item"><img src="'+avatar+'" alt="'+name+'" class="suggestion-avatar">';
            html+='<div class="suggestion-info"><h4>'+name+'</h4><p>'+((p.bio||'').substring(0,40))+'</p></div>';
            html+='<button class="suggestion-follow-btn" data-uid="'+p.id+'"><i class="fas fa-user-plus"></i></button></div>';
        });
        list.innerHTML=html;
        list.querySelectorAll('.suggestion-follow-btn').forEach(function(btn){
            btn.addEventListener('click',async function(){
                var uid=btn.dataset.uid;
                if(state.followedUsers[uid]){await sbUnfollow(currentUser.id,uid);delete state.followedUsers[uid];}
                else{await sbFollow(currentUser.id,uid);state.followedUsers[uid]=true;}
                await loadFollowCounts();
                renderSuggestions();
            });
        });
        list.querySelectorAll('.suggestion-avatar,.suggestion-info').forEach(function(el){
            el.style.cursor='pointer';
            el.addEventListener('click',async function(){
                var item=el.closest('.suggestion-item');
                var uid=item.querySelector('.suggestion-follow-btn').dataset.uid;
                try{var p=await sbGetProfile(uid);if(p) showProfileView(profileToPerson(p));}catch(e){}
            });
        });
    }catch(e){console.error('renderSuggestions:',e);}
}

// ======================== TRENDING GROUPS SIDEBAR ========================
function renderTrendingSidebar(){
    var sorted=groups.slice().sort(function(a,b){return (b.members||0)-(a.members||0);});
    var top=sorted.slice(0,4);
    var html='';
    if(!top.length){html='<p style="color:var(--gray);font-size:13px;text-align:center;">No groups yet. Create one!</p>';}
    top.forEach(function(g){
        html+='<div class="group-item" data-gid="'+g.id+'"><div class="group-icon" style="background:'+(g.color||'#5cbdb9')+'22;color:'+(g.color||'#5cbdb9')+';"><i class="fas '+(g.icon||'fa-users')+'"></i></div>';
        html+='<div class="group-info"><h5 class="group-name">'+g.name+'</h5><p class="group-desc">'+(g.desc||'')+'</p>';
        html+='<span class="group-members"><i class="fas fa-users"></i> '+fmtNum(g.members||0)+' members</span></div></div>';
    });
    $('#trendingGroupsSidebar').innerHTML=html;
    $$('#trendingGroupsSidebar .group-item').forEach(function(el){
        el.addEventListener('click',function(){
            var gid=el.getAttribute('data-gid');
            var group=groups.find(function(g){return g.id===gid;});
            if(group) showGroupView(group);
        });
    });
}

// ======================== GROUPS PAGE ========================
function getGroupBannerBg(g){
    var ps=state.groupActivePremiumSkin[g.id];if(ps){var sk=premiumSkins.find(function(s){return s.id===ps;});if(sk)return sk.preview;}
    var bs=state.groupActiveSkin[g.id];if(bs&&groupSkinBanners[bs])return groupSkinBanners[bs];
    return g.color;
}
function groupCardHtml(g){
    var joined=state.joinedGroups[g.id];
    var isOwner=g.createdBy==='me';
    var bg=getGroupBannerBg(g);
    return '<div class="group-card" data-gid="'+g.id+'"><div class="group-card-banner" style="background:'+bg+';">'+(isOwner?'<button class="gc-icon-edit-btn" data-gid="'+g.id+'" title="Change Icon"><i class="fas fa-pen"></i></button>':'')+'<i class="fas '+g.icon+'"></i></div><div class="group-card-body"><h4>'+g.name+'</h4><p>'+g.desc+'</p><span class="group-members"><i class="fas fa-users"></i> '+fmtNum(g.members)+' members</span></div><div class="group-card-actions"><button class="btn '+(joined?'btn-disabled':'btn-primary')+' join-group-btn" data-gid="'+g.id+'">'+(joined?'Joined':'Join')+'</button><button class="btn btn-outline view-group-btn" data-gid="'+g.id+'">View</button></div></div>';
}
var currentGroupTab=null;
function getGroupCategories(filter){
    var cats=[];
    var filtered=filter?groups.filter(function(g){return g.name.toLowerCase().indexOf(filter.toLowerCase())!==-1||g.desc.toLowerCase().indexOf(filter.toLowerCase())!==-1;}):groups;
    var yourGroups=[],modGroups=[],joinedGroups=[],recommended=[];
    filtered.forEach(function(g){
        var mr=getMyGroupRole(g);
        if(g.createdBy==='me') yourGroups.push(g);
        else if(mr==='Co-Admin'||mr==='Moderator') modGroups.push(g);
        else if(state.joinedGroups[g.id]) joinedGroups.push(g);
        else recommended.push(g);
    });
    if(yourGroups.length) cats.push({key:'yours',label:'<i class="fas fa-crown"></i> My Groups',items:yourGroups});
    if(modGroups.length) cats.push({key:'mod',label:'<i class="fas fa-shield-halved"></i> Moderating',items:modGroups});
    if(joinedGroups.length) cats.push({key:'joined',label:'<i class="fas fa-users"></i> Joined',items:joinedGroups});
    cats.push({key:'discover',label:'<i class="fas fa-compass"></i> Discover',items:recommended});
    return cats;
}
function renderGroups(filter){
    var cats=getGroupCategories(filter);
    if(!currentGroupTab||!cats.find(function(c){return c.key===currentGroupTab;})) currentGroupTab=cats[0].key;
    var tabsHtml='';
    cats.forEach(function(c){tabsHtml+='<button class="search-tab'+(c.key===currentGroupTab?' active':'')+'" data-gtab="'+c.key+'">'+c.label+'</button>';});
    $('#groupsTabs').innerHTML=tabsHtml;
    var active=cats.find(function(c){return c.key===currentGroupTab;});
    var html='';
    if(active.items.length){html+='<div class="shop-scroll-row scroll-2row">';active.items.forEach(function(g){html+=groupCardHtml(g);});html+='</div>';}
    else{html+='<p style="color:var(--gray);font-size:14px;padding:20px 0;text-align:center;">No groups here'+(filter?' matching "'+filter+'"':'')+'.</p>';}
    $('#groupsSections').innerHTML=html;
    bindGroupEvents('#groupsSections');
    initDragScroll('#groupsSections');
    $$('#groupsTabs .search-tab').forEach(function(tab){tab.addEventListener('click',function(){
        $$('#groupsTabs .search-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');currentGroupTab=tab.dataset.gtab;$('#groupSearch').value='';renderGroups();
    });});
}
function bindGroupEvents(container){
    $$(container+' .join-group-btn').forEach(function(btn){
        btn.addEventListener('click',async function(e){
            e.stopPropagation();
            var gid=btn.getAttribute('data-gid');
            if(!state.joinedGroups[gid]&&currentUser){
                try{
                    await sbJoinGroup(gid,currentUser.id);
                    state.joinedGroups[gid]=true;
                    var jg=groups.find(function(g){return g.id===gid;});
                    if(jg)jg.members++;
                    saveState();
                    addNotification('group','You joined "'+jg.name+'"');
                    renderGroups();
                }catch(e2){console.error('Join group:',e2);showToast('Failed to join group');}
            }
        });
    });
    $$(container+' .view-group-btn').forEach(function(btn){
        btn.addEventListener('click',function(e){
            e.stopPropagation();
            var gid=btn.getAttribute('data-gid');
            var group=groups.find(function(g){return g.id===gid;});
            if(group) showGroupView(group);
        });
    });
    $$(container+' .group-card').forEach(function(card){
        card.addEventListener('click',function(){
            var gid=card.getAttribute('data-gid');
            var group=groups.find(function(g){return g.id===gid;});
            if(group) showGroupView(group);
        });
    });
    $$(container+' .gc-icon-edit-btn').forEach(function(btn){
        btn.addEventListener('click',function(e){
            e.stopPropagation();
            var gid=btn.getAttribute('data-gid');
            var group=groups.find(function(g){return g.id===gid;});
            if(!group) return;
            var icons=['fa-users','fa-camera-retro','fa-gamepad','fa-utensils','fa-dumbbell','fa-music','fa-paw','fa-plane-departure','fa-book','fa-leaf','fa-film','fa-hammer','fa-mug-hot','fa-code','fa-palette','fa-rocket','fa-heart','fa-star','fa-fire','fa-bolt','fa-globe','fa-trophy','fa-gem','fa-shield'];
            var h='<div class="modal-header"><h3>Change Icon</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body"><div class="gv-icon-grid">';
            icons.forEach(function(ic){h+='<button class="gv-icon-pick'+(group.icon===ic?' active':'')+'" data-icon="'+ic+'"><i class="fas '+ic+'"></i></button>';});
            h+='</div></div>';showModal(h);
            $$('.gv-icon-pick').forEach(function(pick){pick.addEventListener('click',function(){group.icon=pick.dataset.icon;delete group.profileImg;closeModal();renderGroups();});});
        });
    });
}
$('#groupSearch').addEventListener('input',function(){renderGroups(this.value);});
$('#createGroupBtn').addEventListener('click',function(){
    showModal('<div class="modal-header"><h3>Create Group</h3><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="modal-body"><div style="margin-bottom:14px;"><label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Group Name</label><input type="text" class="post-input" id="newGroupName" placeholder="Enter group name" style="width:100%;"></div><div style="margin-bottom:14px;"><label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Description</label><input type="text" class="post-input" id="newGroupDesc" placeholder="What is this group about?" style="width:100%;"></div><button class="btn btn-primary btn-block" id="submitGroupBtn">Create Group</button></div>');
    document.getElementById('submitGroupBtn').addEventListener('click',async function(){
        var name=document.getElementById('newGroupName').value.trim();
        var desc=document.getElementById('newGroupDesc').value.trim();
        if(!name){return;}
        if(!currentUser){showToast('You must be logged in to create a group.');return;}
        var btn=this;btn.disabled=true;btn.textContent='Creating...';
        try{
            var g=await sbCreateGroup(currentUser.id,name,desc||'A new group on BlipVibe');
            var newGroup={id:g.id,name:g.name,desc:g.description||'',icon:'fa-users',color:'#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),members:1,owner_id:g.owner_id,owner:g.owner,createdBy:'me',description:g.description||'',member_count:g.member_count,mods:[],coverPhoto:null,profileImg:null};
            groups.push(newGroup);
            state.joinedGroups[newGroup.id]=true;
            saveState();
            closeModal();
            showGroupView(newGroup);
            renderGroups();
            addNotification('group','You created the group "'+name+'"');
        }catch(e){
            console.error('Create group:',e);
            showToast('Failed to create group: '+(e.message||'Unknown error'));
            btn.disabled=false;btn.textContent='Create Group';
        }
    });
});

// ======================== PROFILES PAGE ========================
var currentProfileTab='network';
function profileCardHtml(p){
    var name=p.display_name||p.name||p.username||'User';
    var bio=p.bio||'';
    var avatar=p.avatar_url||DEFAULT_AVATAR;
    var isFollowed=state.followedUsers[p.id];
    var isSelf=currentUser&&p.id===currentUser.id;
    return '<div class="profile-card-item"><img src="'+avatar+'" class="profile-card-avatar" data-uid="'+p.id+'"><h4 class="profile-card-name" data-uid="'+p.id+'">'+name+'</h4><p class="profile-card-bio">'+bio.substring(0,60)+'</p>'+(isSelf?'':'<button class="btn '+(isFollowed?'btn-outline':'btn-primary')+' profile-follow-btn" data-uid="'+p.id+'">'+(isFollowed?'Following':'Follow')+'</button>')+'</div>';
}
var _networkRenderVersion=0;
async function renderMyNetwork(container,query){
    if(!currentUser){container.innerHTML='';return;}
    var myVersion=++_networkRenderVersion;
    var html='';
    try{
        var following=await sbGetFollowing(currentUser.id);
        var followers=await sbGetFollowers(currentUser.id);
        if(myVersion!==_networkRenderVersion) return; // stale call, skip
        following=following.filter(function(p){return p&&p.id!==currentUser.id;});
        followers=followers.filter(function(p){return p&&p.id!==currentUser.id;});
        // Deduplicate: separate mutual follows, following-only, followers-only
        var followingIds={};
        following.forEach(function(p){followingIds[p.id]=true;});
        var mutual=following.filter(function(p){return followers.some(function(f){return f.id===p.id;});});
        var followingOnly=following.filter(function(p){return !followers.some(function(f){return f.id===p.id;});});
        var followersOnly=followers.filter(function(p){return !followingIds[p.id];});
        // Filter by search query if provided
        if(query){
            var q=query.toLowerCase();
            var matchName=function(p){return (p.display_name||p.username||'').toLowerCase().indexOf(q)!==-1;};
            mutual=mutual.filter(matchName);
            followingOnly=followingOnly.filter(matchName);
            followersOnly=followersOnly.filter(matchName);
        }
        if(mutual.length){html+='<h3 style="margin:16px 0 8px;">Mutual</h3><div class="search-results-grid">';mutual.forEach(function(p){html+=profileCardHtml({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url});});html+='</div>';}
        if(followingOnly.length){html+='<h3 style="margin:16px 0 8px;">Following</h3><div class="search-results-grid">';followingOnly.forEach(function(p){html+=profileCardHtml({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url});});html+='</div>';}
        if(followersOnly.length){html+='<h3 style="margin:16px 0 8px;">Followers</h3><div class="search-results-grid">';followersOnly.forEach(function(p){html+=profileCardHtml({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url});});html+='</div>';}
        if(!mutual.length&&!followingOnly.length&&!followersOnly.length) html='<div class="empty-state"><i class="fas fa-user-group"></i><p>'+(query?'No results for "'+query+'"':'Your network is empty. Follow some people!')+'</p></div>';
    }catch(e){html='<div class="empty-state"><i class="fas fa-user-group"></i><p>Could not load network.</p></div>';}
    if(myVersion!==_networkRenderVersion) return;
    container.innerHTML=html;
    bindProfileEvents(container.closest('.page')?'#'+container.closest('.page').id:'#profilesSections');
}
var _discoverRenderVersion=0;
async function renderDiscover(container,query){
    var myVersion=++_discoverRenderVersion;
    var html='';
    try{
        var profiles;
        if(query){
            // Search: search ALL profiles on BlipVibe
            profiles=await sbSearchProfiles(query,30);
            if(currentUser) profiles=profiles.filter(function(p){return p.id!==currentUser.id;});
        } else {
            // No search: show friends-of-friends first, then fill with other users
            profiles=[];
            if(currentUser){
                try{profiles=await sbGetFriendsOfFriends(currentUser.id,20);}catch(e){console.warn('FoF:',e);}
            }
            // If not enough friends-of-friends, add other profiles
            if(profiles.length<10){
                var all=await sbGetAllProfiles(50);
                var networkIds={};
                if(currentUser){
                    networkIds[currentUser.id]=true;
                    Object.keys(state.followedUsers).forEach(function(k){networkIds[k]=true;});
                    try{var myFollowers=await sbGetFollowers(currentUser.id);myFollowers.forEach(function(f){if(f&&f.id)networkIds[f.id]=true;});}catch(e){}
                }
                var existing={}; profiles.forEach(function(p){existing[p.id]=true;});
                var extras=all.filter(function(p){return !networkIds[p.id]&&!existing[p.id];});
                profiles=profiles.concat(extras);
            }
        }
        if(!profiles.length) html='<div class="empty-state"><i class="fas fa-users"></i><p>'+(query?'No results for "'+query+'"':'No suggestions yet')+'</p></div>';
        else{html='<div class="search-results-grid">';profiles.forEach(function(p){html+=profileCardHtml({id:p.id,name:p.display_name||p.username,bio:p.bio||'',avatar_url:p.avatar_url});});html+='</div>';}
    }catch(e){console.error('renderDiscover:',e);html='<div class="empty-state"><i class="fas fa-users"></i><p>Could not load profiles.</p></div>';}
    if(myVersion!==_discoverRenderVersion) return;
    container.innerHTML=html;
    bindProfileEvents(container.closest('.page')?'#'+container.closest('.page').id:'#profilesSections');
}
function renderProfiles(tab,query){
    var container=$('#profilesSections');
    if(!container) return;
    var t=tab||currentProfileTab||'network';
    if(t==='network') renderMyNetwork(container,query||'');
    else renderDiscover(container,query||'');
}
function bindProfileEvents(c){
    $$(c+' .profile-follow-btn').forEach(function(btn){btn.addEventListener('click',function(){toggleFollow(btn.dataset.uid,btn);});});
    $$(c+' .profile-view-btn').forEach(function(btn){btn.addEventListener('click',async function(){
        var uid=btn.dataset.uid;if(!uid)return;
        try{var p=await sbGetProfile(uid);if(p)showProfileView(profileToPerson(p));}catch(e){}
    });});
    $$(c+' .profile-card-avatar, '+c+' .profile-card-name').forEach(function(el){el.style.cursor='pointer';el.addEventListener('click',async function(){
        var uid=el.dataset.uid;if(!uid)return;
        try{var p=await sbGetProfile(uid);if(p)showProfileView(profileToPerson(p));}catch(e){}
    });});
}
$$('#profilesTabs .search-tab').forEach(function(tab){
    tab.addEventListener('click',function(){
        $$('#profilesTabs .search-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');
        currentProfileTab=tab.dataset.ptab;
        $('#profileSearch').value='';
        renderProfiles(currentProfileTab);
    });
});
$('#profileSearch').addEventListener('input',function(){
    var q=this.value.trim();
    renderProfiles(currentProfileTab,q);
});

// ======================== SKIN SHOP ========================
function shopCard(preview,body){return '<div class="skin-card"><div class="skin-preview" style="background:'+preview+';">'+body+'</div>';}
function shopBuy(owned,price,cls,attr){
    if(owned) return '<button class="btn btn-disabled">Owned</button>';
    return '<div class="skin-price"><i class="fas fa-coins"></i> '+price+' Coins</div><button class="btn '+(state.coins>=price?'btn-primary':'btn-disabled')+' '+cls+'" '+attr+(state.coins<price?' disabled':'')+'>Buy</button>';
}
var currentShopTab=null;
function getShopCategories(){
    var cats=[];
    cats.push({key:'basic',label:'<i class="fas fa-palette"></i> Basic Skins',items:skins,render:function(s){return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div class="skin-preview-inner" style="color:#333;background:#fff;">Profile Preview</div></div><div class="skin-card-body" style="background:'+s.cardBg+';"><h4 style="color:'+s.cardText+';">'+s.name+'</h4><p style="color:'+s.cardMuted+';">'+s.desc+'</p>'+shopBuy(state.ownedSkins[s.id],s.price,'buy-skin-btn','data-sid="'+s.id+'"')+'</div></div>';}});
    cats.push({key:'premium',label:'<i class="fas fa-gem"></i> Premium Skins',items:premiumSkins,render:function(s){return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div class="premium-preview-frame" style="background:'+s.border+';"><img src="images/default-avatar.svg" class="premium-preview-avatar"></div></div><div class="skin-card-body"><h4><i class="fas '+s.icon+'" style="color:'+s.iconColor+';margin-right:6px;"></i>'+s.name+'</h4><p>'+s.desc+'</p>'+shopBuy(state.ownedPremiumSkins[s.id],s.price,'buy-premium-btn','data-pid="'+s.id+'"')+'</div></div>';}});
    cats.push({key:'fonts',label:'<i class="fas fa-font"></i> Font Styles',items:fonts,render:function(f){return '<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#667eea,#764ba2);"><span style="font-family:\''+f.family+'\',sans-serif;color:#fff;font-size:24px;">Aa Bb Cc</span></div><div class="skin-card-body"><h4 style="font-family:\''+f.family+'\',sans-serif;">'+f.name+'</h4><p>'+f.desc+'</p>'+shopBuy(state.ownedFonts[f.id],f.price,'buy-font-btn','data-fid="'+f.id+'"')+'</div></div>';}});
    cats.push({key:'logos',label:'<i class="fas fa-star"></i> Logo Styles',items:logos,render:function(l){return '<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#f093fb,#f5576c);"><span style="color:#fff;font-size:22px;font-weight:700;">'+l.text+'</span></div><div class="skin-card-body"><h4>'+l.name+'</h4><p>'+l.desc+'</p>'+shopBuy(state.ownedLogos[l.id],l.price,'buy-logo-btn','data-lid="'+l.id+'"')+'</div></div>';}});
    cats.push({key:'icons',label:'<i class="fas fa-icons"></i> Icon Sets',items:iconSets,render:function(s){var prev='';Object.keys(s.icons).slice(0,5).forEach(function(k){prev+='<i class="fas '+s.icons[k]+'" style="margin:0 4px;font-size:18px;"></i>';});return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div style="color:#fff;">'+prev+'</div></div><div class="skin-card-body"><h4>'+s.name+'</h4><p>'+s.desc+'</p>'+shopBuy(state.ownedIconSets[s.id],s.price,'buy-icon-btn','data-iid="'+s.id+'"')+'</div></div>';}});
    cats.push({key:'coins',label:'<i class="fas fa-coins"></i> Coin Skins',items:coinSkins,render:function(s){return '<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#1a1a2e,#16213e);"><i class="fas '+s.icon+'" style="font-size:36px;color:'+s.color+';"></i></div><div class="skin-card-body"><h4>'+s.name+'</h4><p>'+s.desc+'</p>'+shopBuy(state.ownedCoinSkins[s.id],s.price,'buy-coin-btn','data-cid="'+s.id+'"')+'</div></div>';}});
    cats.push({key:'templates',label:'<i class="fas fa-table-columns"></i> Templates',items:templates,render:function(t){return '<div class="skin-card"><div class="skin-preview" style="background:'+t.preview+';"><i class="fas fa-table-columns" style="font-size:36px;color:rgba(255,255,255,.9);"></i></div><div class="skin-card-body"><h4>'+t.name+'</h4><p>'+t.desc+'</p>'+shopBuy(state.ownedTemplates[t.id],t.price,'buy-tpl-btn','data-tid="'+t.id+'"')+'</div></div>';}});
    cats.push({key:'navstyles',label:'<i class="fas fa-bars-staggered"></i> Nav Styles',items:navStyles,render:function(n){return '<div class="skin-card"><div class="skin-preview" style="background:'+n.preview+';"><i class="fas fa-bars-staggered" style="font-size:36px;color:rgba(255,255,255,.9);"></i></div><div class="skin-card-body"><h4>'+n.name+'</h4><p>'+n.desc+'</p>'+shopBuy(state.ownedNavStyles[n.id],n.price,'buy-nav-btn','data-nid="'+n.id+'"')+'</div></div>';}});
    return cats;
}
function renderShop(){
    var cats=getShopCategories();
    if(!currentShopTab) currentShopTab=cats[0].key;
    var tabsHtml='';
    cats.forEach(function(c){tabsHtml+='<button class="search-tab'+(c.key===currentShopTab?' active':'')+'" data-stab="'+c.key+'">'+c.label+'</button>';});
    $('#shopTabs').innerHTML=tabsHtml;
    var active=cats.find(function(c){return c.key===currentShopTab;});
    var html='<div class="shop-scroll-row scroll-2row">';
    active.items.forEach(function(item){html+=active.render(item);});
    html+='</div>';
    $('#shopGrid').innerHTML=html;
    function shopPurchased(btn){var p=btn.parentElement;var priceEl=p.querySelector('.skin-price');if(priceEl)priceEl.remove();btn.className='btn btn-disabled';btn.textContent='Owned';btn.disabled=true;btn.replaceWith(btn.cloneNode(true));renderMySkins();saveState();}
    $$('.buy-skin-btn').forEach(function(btn){btn.addEventListener('click',function(){var sid=btn.getAttribute('data-sid');var skin=skins.find(function(s){return s.id===sid;});if(state.coins>=skin.price){state.coins-=skin.price;state.ownedSkins[sid]=true;updateCoins();shopPurchased(btn);addNotification('skin','You purchased the "'+skin.name+'" skin!');}});});
    $$('.buy-font-btn').forEach(function(btn){btn.addEventListener('click',function(){var fid=btn.getAttribute('data-fid');var font=fonts.find(function(f){return f.id===fid;});if(state.coins>=font.price){state.coins-=font.price;state.ownedFonts[fid]=true;updateCoins();shopPurchased(btn);addNotification('skin','You purchased the "'+font.name+'" font!');}});});
    $$('.buy-logo-btn').forEach(function(btn){btn.addEventListener('click',function(){var lid=btn.getAttribute('data-lid');var logo=logos.find(function(l){return l.id===lid;});if(state.coins>=logo.price){state.coins-=logo.price;state.ownedLogos[lid]=true;updateCoins();shopPurchased(btn);addNotification('skin','You purchased the "'+logo.name+'" logo!');}});});
    $$('.buy-icon-btn').forEach(function(btn){btn.addEventListener('click',function(){var iid=btn.getAttribute('data-iid');var s=iconSets.find(function(x){return x.id===iid;});if(state.coins>=s.price){state.coins-=s.price;state.ownedIconSets[iid]=true;updateCoins();shopPurchased(btn);addNotification('skin','You purchased the "'+s.name+'" icon set!');}});});
    $$('.buy-coin-btn').forEach(function(btn){btn.addEventListener('click',function(){var cid=btn.getAttribute('data-cid');var s=coinSkins.find(function(x){return x.id===cid;});if(state.coins>=s.price){state.coins-=s.price;state.ownedCoinSkins[cid]=true;updateCoins();shopPurchased(btn);addNotification('skin','You purchased the "'+s.name+'" coin skin!');}});});
    $$('.buy-tpl-btn').forEach(function(btn){btn.addEventListener('click',function(){var tid=btn.getAttribute('data-tid');var t=templates.find(function(x){return x.id===tid;});if(state.coins>=t.price){state.coins-=t.price;state.ownedTemplates[tid]=true;updateCoins();shopPurchased(btn);addNotification('skin','You purchased the "'+t.name+'" template!');}});});
    $$('.buy-premium-btn').forEach(function(btn){btn.addEventListener('click',function(){var pid=btn.getAttribute('data-pid');var skin=premiumSkins.find(function(s){return s.id===pid;});if(state.coins>=skin.price){state.coins-=skin.price;state.ownedPremiumSkins[pid]=true;updateCoins();shopPurchased(btn);addNotification('skin','You purchased the "'+skin.name+'" premium skin!');}});});
    $$('.buy-nav-btn').forEach(function(btn){btn.addEventListener('click',function(){var nid=btn.getAttribute('data-nid');var n=navStyles.find(function(x){return x.id===nid;});if(state.coins>=n.price){state.coins-=n.price;state.ownedNavStyles[nid]=true;updateCoins();shopPurchased(btn);addNotification('skin','You purchased the "'+n.name+'" nav style!');}});});
    initDragScroll('#shopGrid');
    $$('#shopTabs .search-tab').forEach(function(tab){tab.addEventListener('click',function(){
        $$('#shopTabs .search-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');currentShopTab=tab.dataset.stab;renderShop();
    });});
}

// ======================== GROUP SHOP ========================
var currentGroupShopTab=null;

function groupShopBuy(groupId,owned,price,cls,attr){
    var gc=getGroupCoinCount(groupId);
    if(owned) return '<button class="btn btn-disabled">Owned</button>';
    return '<div class="skin-price"><i class="fas fa-coins" style="color:#f59e0b;"></i> '+price+' Group Coins</div><button class="btn '+(gc>=price?'btn-primary':'btn-disabled')+' '+cls+'" '+attr+(gc<price?' disabled':'')+'>Buy</button>';
}

function getGroupShopCategories(groupId){
    var cats=[];
    if(!state.groupOwnedSkins[groupId]) state.groupOwnedSkins[groupId]={};
    if(!state.groupOwnedPremiumSkins[groupId]) state.groupOwnedPremiumSkins[groupId]={};

    cats.push({key:'basic',label:'<i class="fas fa-palette"></i> Basic Skins',items:skins,render:function(s){
        return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div class="skin-preview-inner" style="color:#333;background:#fff;">Preview</div></div><div class="skin-card-body" style="background:'+s.cardBg+';"><h4 style="color:'+s.cardText+';">'+s.name+'</h4><p style="color:'+s.cardMuted+';">'+s.desc+'</p>'+groupShopBuy(groupId,state.groupOwnedSkins[groupId][s.id],s.price,'buy-gskin-btn','data-sid="'+s.id+'" data-gid="'+groupId+'"')+'</div></div>';
    }});

    cats.push({key:'premium',label:'<i class="fas fa-gem"></i> Premium Skins',items:premiumSkins,render:function(s){
        return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div class="premium-preview-frame" style="background:'+s.border+';"><img src="images/default-avatar.svg" class="premium-preview-avatar"></div></div><div class="skin-card-body"><h4><i class="fas '+s.icon+'" style="color:'+s.iconColor+';margin-right:6px;"></i>'+s.name+'</h4><p>'+s.desc+'</p>'+groupShopBuy(groupId,state.groupOwnedPremiumSkins[groupId][s.id],s.price,'buy-gspremium-btn','data-pid="'+s.id+'" data-gid="'+groupId+'"')+'</div></div>';
    }});

    cats.push({key:'guild',label:'<i class="fas fa-shield-halved"></i> Guild Skins',items:guildSkins,render:function(s){
        return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div class="skin-preview-inner" style="color:'+s.cardText+';background:'+s.cardBg+';">Guild</div></div><div class="skin-card-body" style="background:'+s.cardBg+';"><h4 style="color:'+s.cardText+';">'+s.name+'</h4><p style="color:'+s.cardMuted+';">'+s.desc+'</p>'+groupShopBuy(groupId,state.groupOwnedSkins[groupId][s.id],s.price,'buy-gskin-btn','data-sid="'+s.id+'" data-gid="'+groupId+'"')+'</div></div>';
    }});

    // Apply Skins tab (always visible)
    var ownedBasic=skins.filter(function(s){return state.groupOwnedSkins[groupId][s.id];});
    var ownedGuild=guildSkins.filter(function(s){return state.groupOwnedSkins[groupId][s.id];});
    var ownedPrem=premiumSkins.filter(function(s){return state.groupOwnedPremiumSkins[groupId][s.id];});
    var allOwned=ownedBasic.concat(ownedGuild).concat(ownedPrem);
    if(allOwned.length){
        cats.push({key:'owned',label:'<i class="fas fa-check-circle"></i> Apply Skins',items:allOwned,render:function(s){
            var isPremium=!!s.border;
            var isActive=isPremium?(state.groupActivePremiumSkin[groupId]===s.id):(state.groupActiveSkin[groupId]===s.id);
            var bodyStyle=s.cardBg?'background:'+s.cardBg+';':'';
            var titleStyle=s.cardText?'color:'+s.cardText+';':'';
            var descStyle=s.cardMuted?'color:'+s.cardMuted+';':'';
            var inner=isPremium?'<div class="premium-preview-frame" style="background:'+s.border+';"><img src="images/default-avatar.svg" class="premium-preview-avatar"></div>':'<div class="skin-preview-inner" style="color:#333;background:#fff;">Preview</div>';
            return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';">'+inner+'</div><div class="skin-card-body" style="'+bodyStyle+'"><h4 style="'+titleStyle+'">'+(s.icon?'<i class="fas '+s.icon+'" style="color:'+s.iconColor+';margin-right:6px;"></i>':'')+s.name+'</h4><p style="'+descStyle+'">'+s.desc+'</p><button class="btn '+(isActive?'btn-disabled':'btn-primary')+' apply-gskin-btn" data-sid="'+s.id+'" data-gid="'+groupId+'" data-premium="'+(isPremium?'1':'0')+'">'+(isActive?'Active':'Apply')+'</button></div></div>';
        }});
    } else {
        cats.push({key:'owned',label:'<i class="fas fa-check-circle"></i> Apply Skins',items:[null],render:function(){
            return '<div style="padding:24px;text-align:center;color:var(--muted);width:100%;"><i class="fas fa-palette" style="font-size:2rem;margin-bottom:8px;display:block;opacity:.4;"></i>No skins owned yet.<br>Purchase skins from the other tabs to apply them here.</div>';
        }});
    }

    return cats;
}

function renderGroupShop(groupId){
    var container=document.getElementById('gvShopContent');
    if(!container) return;
    var cats=getGroupShopCategories(groupId);
    if(!currentGroupShopTab) currentGroupShopTab=cats[0].key;
    if(!cats.find(function(c){return c.key===currentGroupShopTab;})) currentGroupShopTab=cats[0].key;

    var tabsHtml='';
    cats.forEach(function(c){tabsHtml+='<button class="search-tab'+(c.key===currentGroupShopTab?' active':'')+'" data-gstab="'+c.key+'">'+c.label+'</button>';});
    document.getElementById('gvShopTabs').innerHTML=tabsHtml;

    var active=cats.find(function(c){return c.key===currentGroupShopTab;});
    var html='<div class="shop-scroll-row scroll-2row">';
    active.items.forEach(function(item){html+=active.render(item);});
    html+='</div>';
    container.innerHTML=html;

    function gShopPurchased(btn){var p=btn.parentElement;var priceEl=p.querySelector('.skin-price');if(priceEl)priceEl.remove();btn.className='btn btn-disabled';btn.textContent='Owned';btn.disabled=true;btn.replaceWith(btn.cloneNode(true));}

    $$('#gvShopContent .buy-gskin-btn').forEach(function(btn){btn.addEventListener('click',function(){
        var sid=btn.getAttribute('data-sid');var gid=btn.getAttribute('data-gid');
        var skin=skins.find(function(s){return s.id===sid;})||guildSkins.find(function(s){return s.id===sid;});
        if(!skin) return;
        var gc=getGroupCoinCount(gid);
        if(gc>=skin.price){
            state.groupCoins[gid]-=skin.price;
            if(!state.groupOwnedSkins[gid]) state.groupOwnedSkins[gid]={};
            state.groupOwnedSkins[gid][sid]=true;
            updateGroupCoinDisplay(gid);gShopPurchased(btn);
            addNotification('skin','Group purchased the "'+skin.name+'" skin!');
        }
    });});

    $$('#gvShopContent .buy-gspremium-btn').forEach(function(btn){btn.addEventListener('click',function(){
        var pid=btn.getAttribute('data-pid');var gid=btn.getAttribute('data-gid');
        var skin=premiumSkins.find(function(s){return s.id===pid;});
        if(!skin) return;
        var gc=getGroupCoinCount(gid);
        if(gc>=skin.price){
            state.groupCoins[gid]-=skin.price;
            if(!state.groupOwnedPremiumSkins[gid]) state.groupOwnedPremiumSkins[gid]={};
            state.groupOwnedPremiumSkins[gid][pid]=true;
            updateGroupCoinDisplay(gid);gShopPurchased(btn);
            addNotification('skin','Group purchased the "'+skin.name+'" premium skin!');
        }
    });});

    $$('#gvShopContent .apply-gskin-btn').forEach(function(btn){btn.addEventListener('click',function(){
        var sid=btn.getAttribute('data-sid');var gid=btn.getAttribute('data-gid');
        var isPremium=btn.getAttribute('data-premium')==='1';
        if(isPremium){state.groupActivePremiumSkin[gid]=sid;state.groupActiveSkin[gid]=null;}
        else{state.groupActiveSkin[gid]=sid;state.groupActivePremiumSkin[gid]=null;}
        applyGroupSkin(gid);renderGroupShop(gid);renderGroups();saveState();
    });});

    initDragScroll('#gvShopContent');

    $$('#gvShopTabs .search-tab').forEach(function(tab){tab.addEventListener('click',function(){
        $$('#gvShopTabs .search-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');currentGroupShopTab=tab.dataset.gstab;renderGroupShop(groupId);
    });});

    // Swipe left/right to switch Group Shop tabs
    var _gsTx=0;
    container.addEventListener('touchstart',function(e){_gsTx=e.touches[0].clientX;},{passive:true});
    container.addEventListener('touchend',function(e){
        var dx=e.changedTouches[0].clientX-_gsTx;
        if(Math.abs(dx)<50) return;
        var keys=cats.map(function(c){return c.key;});
        var ci=keys.indexOf(currentGroupShopTab);
        if(dx<0&&ci<keys.length-1){currentGroupShopTab=keys[ci+1];renderGroupShop(groupId);}
        else if(dx>0&&ci>0){currentGroupShopTab=keys[ci-1];renderGroupShop(groupId);}
    });
}

function updateGroupCoinDisplay(gid){
    var el=document.getElementById('gvGroupCoinCount');if(el)el.textContent=getGroupCoinCount(gid);
    var el2=document.getElementById('gvGroupCoinCount2');if(el2)el2.textContent=getGroupCoinCount(gid);
}

var groupSkinBgs={
    classic:'#e8f6f5',midnight:'#1a1a2e',ocean:'#d0e8f7',forest:'#dceede',royal:'#ede0f3',
    sunset:'#fff3e0',cherry:'#fce4ec',slate:'#2c3a42',ember:'#fbe9e7',arctic:'#d8f3f6',moss:'#ecf4e2',
    'guild-banner':'#efe0c8','guild-fortress':'#d5d5d5','guild-dragon':'#1a0505',
    'guild-enchanted':'#dceede','guild-ocean':'#d0e8f7','guild-celestial':'#15152e',
    'guild-steampunk':'#efe0c8','guild-frost':'#d8f3f6'
};
var groupSkinBanners={
    classic:'linear-gradient(135deg,#5cbdb9,#4aada9)',midnight:'#1a1a2e',ocean:'linear-gradient(135deg,#1976d2,#0d47a1)',
    forest:'linear-gradient(135deg,#2e7d32,#1b5e20)',royal:'linear-gradient(135deg,#7b1fa2,#4a148c)',
    sunset:'linear-gradient(135deg,#ef6c00,#e65100)',cherry:'linear-gradient(135deg,#d81b60,#c2185b)',
    slate:'linear-gradient(135deg,#37474f,#263238)',ember:'linear-gradient(135deg,#e64a19,#bf360c)',
    arctic:'linear-gradient(135deg,#00acc1,#00838f)',moss:'linear-gradient(135deg,#689f38,#558b2f)',
    'guild-banner':'linear-gradient(135deg,#8B4513,#DAA520)','guild-fortress':'linear-gradient(135deg,#4a4a4a,#7a7a7a)',
    'guild-dragon':'linear-gradient(135deg,#8b0000,#ff4500)','guild-enchanted':'linear-gradient(135deg,#1a472a,#2d8659)',
    'guild-ocean':'linear-gradient(135deg,#1a3a5c,#2980b9)','guild-celestial':'linear-gradient(135deg,#1a1a3e,#4a0080)',
    'guild-steampunk':'linear-gradient(135deg,#5c3a1e,#b87333)','guild-frost':'linear-gradient(135deg,#0a2a4a,#00bcd4)'
};
function applyGroupSkin(groupId){
    var gvPage=document.getElementById('page-group-view');
    var banner=document.getElementById('gvCoverBanner');
    var profileCover=gvPage.querySelector('.profile-cover');
    var iconWrap=gvPage.querySelector('.gv-icon-wrap');
    var grp=groups.find(function(g){return g.id===groupId;});
    var hasCover=grp&&grp.coverPhoto;
    // Save personal skin state once when entering group view
    if(!_gvSaved) _gvSaved={skin:state.activeSkin,premiumSkin:state.activePremiumSkin,bgImage:premiumBgImage,bgSat:premiumBgSaturation};
    // Hide premium bg in group view
    var _bgLayer=document.getElementById('premiumBgLayer');if(_bgLayer)_bgLayer.classList.remove('active');
    // Clear group-specific classes
    skins.forEach(function(s){gvPage.classList.remove('gskin-'+s.id);});
    guildSkins.forEach(function(s){gvPage.classList.remove('gskin-'+s.id);});
    premiumSkins.forEach(function(s){gvPage.classList.remove('gpremium-'+s.id);});
    gvPage.classList.remove('gpremium-dark');
    gvPage.style.background='';
    if(banner&&!hasCover) banner.style.background='';
    if(profileCover) profileCover.style.background='';
    var activePremium=state.groupActivePremiumSkin[groupId];
    var activeBasic=state.groupActiveSkin[groupId];
    if(iconWrap) iconWrap.style.background=activePremium||activeBasic?'':'var(--primary)';
    if(activePremium){
        var skin=premiumSkins.find(function(s){return s.id===activePremium;});
        if(skin){gvPage.classList.add('gpremium-'+activePremium);if(skin.dark)gvPage.classList.add('gpremium-dark');}
        gvPage.style.background=skin&&skin.dark?'#0f172a':'#f0f0f0';
        if(banner&&!hasCover) banner.style.background=skin&&skin.dark?'#0f172a':'';
        if(profileCover) profileCover.style.background=skin?skin.preview:'';
        if(iconWrap) iconWrap.style.background=skin?skin.accent:'';
        applyPremiumSkin(activePremium,true);
    } else if(activeBasic){
        gvPage.classList.add('gskin-'+activeBasic);
        gvPage.style.background=groupSkinBgs[activeBasic]||'';
        if(banner&&!hasCover) banner.style.background=groupSkinBanners[activeBasic]||'';
        if(profileCover) profileCover.style.background=groupSkinBanners[activeBasic]||'';
        if(iconWrap){var sc=skinColors[activeBasic];iconWrap.style.background=sc?sc.primary:(grp?grp.color:'');}
        applySkin(activeBasic,true);
    } else {
        applySkin(null,true);
    }
}

var skinColors={
    classic:{primary:'#5cbdb9',hover:'#4aada9',navBg:'#5cbdb9',light:true},
    midnight:{primary:'#e94560',hover:'#c73a52',navBg:'#16213e'},
    ocean:{primary:'#1976d2',hover:'#1565c0',navBg:'#1565c0',light:true},
    forest:{primary:'#2e7d32',hover:'#1b5e20',navBg:'#2e7d32',light:true},
    royal:{primary:'#7b1fa2',hover:'#6a1b9a',navBg:'#6a1b9a',light:true},
    sunset:{primary:'#ef6c00',hover:'#e65100',navBg:'#e65100',light:true},
    cherry:{primary:'#d81b60',hover:'#c2185b',navBg:'#c2185b',light:true},
    slate:{primary:'#78909c',hover:'#607d8b',navBg:'#37474f'},
    ember:{primary:'#e64a19',hover:'#bf360c',navBg:'#bf360c',light:true},
    arctic:{primary:'#00acc1',hover:'#00838f',navBg:'#00838f',light:true},
    moss:{primary:'#689f38',hover:'#558b2f',navBg:'#558b2f',light:true},
    'guild-banner':{primary:'#DAA520',hover:'#8B4513',navBg:'#8B4513',light:true},
    'guild-fortress':{primary:'#7a7a7a',hover:'#4a4a4a',navBg:'#4a4a4a',light:true},
    'guild-dragon':{primary:'#ff4500',hover:'#8b0000',navBg:'#8b0000'},
    'guild-enchanted':{primary:'#2d8659',hover:'#1a472a',navBg:'#1a472a',light:true},
    'guild-ocean':{primary:'#2980b9',hover:'#1a3a5c',navBg:'#1a3a5c',light:true},
    'guild-celestial':{primary:'#b388ff',hover:'#4a0080',navBg:'#1a1a3e'},
    'guild-steampunk':{primary:'#b87333',hover:'#5c3a1e',navBg:'#5c3a1e',light:true},
    'guild-frost':{primary:'#00bcd4',hover:'#0a2a4a',navBg:'#0a2a4a',light:true}
};

function setThemeVars(light){
    var root=document.documentElement;
    if(light){
        root.style.setProperty('--dark','#333');root.style.setProperty('--gray','#777');root.style.setProperty('--light-bg','#f0f0f0');
        root.style.setProperty('--card','#fff');root.style.setProperty('--border','#e8e8e8');
        root.style.setProperty('--shadow','0 2px 8px rgba(0,0,0,.08)');root.style.setProperty('--shadow-hover','0 4px 16px rgba(0,0,0,.12)');
        document.body.style.backgroundImage='none';
    } else {
        root.style.setProperty('--dark','#e2e8f0');root.style.setProperty('--gray','#94a3b8');root.style.setProperty('--light-bg','#0f172a');
        root.style.setProperty('--card','#1e293b');root.style.setProperty('--border','#334155');
        root.style.setProperty('--shadow','0 2px 8px rgba(0,0,0,.25)');root.style.setProperty('--shadow-hover','0 4px 16px rgba(0,0,0,.35)');
        document.body.style.backgroundImage='';
    }
}
function applySkin(skinId,silent){
    var card=$('#profileCard');
    var root=document.documentElement;
    skins.forEach(function(s){card.classList.remove('skin-'+s.id);document.body.classList.remove('skin-'+s.id);});
    premiumSkins.forEach(function(s){document.body.classList.remove('premium-'+s.id);});
    document.body.classList.remove('premium-dark');
    var avatars=document.querySelectorAll('#profileAvatarImg, .pv-profile-card .profile-avatar, .nav-avatar');
    avatars.forEach(function(av){av.classList.remove('premium-border');av.removeAttribute('data-premium');});
    if(!silent){state.activePremiumSkin=null;updatePremiumBg();}
    if(skinId&&skinId!=='default'){
        card.classList.add('skin-'+skinId);
        document.body.classList.add('skin-'+skinId);
        if(!silent) state.activeSkin=skinId;
        var colors=skinColors[skinId];
        if(colors){
            root.style.setProperty('--primary',colors.primary);
            root.style.setProperty('--primary-hover',colors.hover);
            root.style.setProperty('--nav-bg',colors.navBg||colors.primary);
            setThemeVars(!!colors.light);
        }
        if(!silent){var skin=skins.find(function(s){return s.id===skinId;});addNotification('skin','You applied the "'+skin.name+'" skin!');}
    } else {
        if(!silent) state.activeSkin=null;
        root.style.setProperty('--primary','#8b5cf6');
        root.style.setProperty('--primary-hover','#7c3aed');
        root.style.setProperty('--nav-bg','#0f172a');
        setThemeVars(false);
    }
}

function applyFont(fontId,silent){
    if(fontId){var f=fonts.find(function(x){return x.id===fontId;});document.body.style.fontFamily="'"+f.family+"',sans-serif";document.documentElement.style.setProperty('--font-scale',f.scale||1);if(!silent)state.activeFont=fontId;}
    else{document.body.style.fontFamily="'Roboto',sans-serif";document.documentElement.style.setProperty('--font-scale',1);if(!silent)state.activeFont=null;}
}

function applyLogo(logoId){
    if(logoId){var l=logos.find(function(x){return x.id===logoId;});$('.nav-logo').textContent=l.text;state.activeLogo=logoId;}
    else{$('.nav-logo').textContent='BlipVibe';state.activeLogo=null;}
}

function applyIconSet(setId){
    var prev=JSON.parse(JSON.stringify(activeIcons));
    var icons=setId?iconSets.find(function(s){return s.id===setId;}).icons:defaultIcons;
    var newMap={};
    Object.keys(defaultIcons).forEach(function(k){newMap[k]=icons[k]||defaultIcons[k];});
    Object.keys(newMap).forEach(function(k){
        if(prev[k]!==newMap[k]){
            document.querySelectorAll('i.'+prev[k]).forEach(function(el){el.classList.remove(prev[k]);el.classList.add(newMap[k]);});
        }
    });
    // Update nav icons specifically (they use data-page)
    ['home','groups','skins','profiles','shop','messages','notifications'].forEach(function(page){var el=document.querySelector('.nav-link[data-page="'+page+'"] i');if(el){el.className='fas '+newMap[page];}});
    activeIcons=newMap;
    state.activeIconSet=setId;
    if(setId)addNotification('skin','You applied the "'+iconSets.find(function(s){return s.id===setId;}).name+'" icon set!');
}

function applyCoinSkin(skinId){
    var icon=skinId?coinSkins.find(function(s){return s.id===skinId;}).icon:'fa-coins';
    var color=skinId?coinSkins.find(function(s){return s.id===skinId;}).color:'#ffd700';
    $$('.nav-coins i, .profile-coins i').forEach(function(el){el.className='fas '+icon;});
    document.querySelector('.nav-coins').style.color=color;
    state.activeCoinSkin=skinId;
    if(skinId)addNotification('skin','You applied the "'+coinSkins.find(function(s){return s.id===skinId;}).name+'" coin skin!');
}

function applyTemplate(tplId,silent){
    templates.forEach(function(t){document.body.classList.remove('tpl-'+t.id);});
    if(tplId){document.body.classList.add('tpl-'+tplId);if(!silent){state.activeTemplate=tplId;addNotification('skin','You applied the "'+templates.find(function(t){return t.id===tplId;}).name+'" template!');}}
    else{if(!silent)state.activeTemplate=null;}
}

function applyNavStyle(nsId){
    navStyles.forEach(function(n){document.body.classList.remove('nav-'+n.id);});
    if(nsId){document.body.classList.add('nav-'+nsId);state.activeNavStyle=nsId;addNotification('skin','You applied the "'+navStyles.find(function(n){return n.id===nsId;}).name+'" nav style!');}
    else{state.activeNavStyle=null;}
}

// Premium background (runtime only, no persistence)
var premiumBgImage=null;
var premiumBgSaturation=100;

function updatePremiumBg(){
    var layer=document.getElementById('premiumBgLayer');
    if(!layer)return;
    if(premiumBgImage&&state.activePremiumSkin){
        layer.style.backgroundImage='url('+premiumBgImage+')';
        layer.style.filter='saturate('+premiumBgSaturation+'%)';
        layer.classList.add('active');
    } else {
        layer.style.backgroundImage='';
        layer.style.filter='';
        layer.classList.remove('active');
    }
}

function applyPremiumSkin(skinId,silent){
    var root=document.documentElement;var card=$('#profileCard');
    // Clear all premium classes
    premiumSkins.forEach(function(s){document.body.classList.remove('premium-'+s.id);});
    document.body.classList.remove('premium-dark');
    var avatars=document.querySelectorAll('#profileAvatarImg, .pv-profile-card .profile-avatar, .nav-avatar');
    avatars.forEach(function(av){av.classList.remove('premium-border');av.removeAttribute('data-premium');});
    if(skinId&&skinId!=='default'){
        // Clear basic skin first
        skins.forEach(function(s){card.classList.remove('skin-'+s.id);document.body.classList.remove('skin-'+s.id);});
        if(!silent)state.activeSkin=null;
        // Apply premium
        var skin=premiumSkins.find(function(s){return s.id===skinId;});
        document.body.classList.add('premium-'+skinId);
        if(skin.dark) document.body.classList.add('premium-dark');
        root.style.setProperty('--primary',skin.accent);
        root.style.setProperty('--primary-hover',skin.accentHover);
        root.style.setProperty('--nav-bg',skin.accent);
        avatars.forEach(function(av){av.classList.add('premium-border');av.setAttribute('data-premium',skinId);});
        if(!silent){state.activePremiumSkin=skinId;addNotification('skin','You applied the "'+skin.name+'" premium skin!');}
        updatePremiumBg();
    } else {
        if(!silent) state.activePremiumSkin=null;
        updatePremiumBg();
        applySkin(state.activeSkin,true);
    }
}

var currentMySkinsTab=null;
function getMySkinCategories(){
    var cats=[];
    var ownedS=skins.filter(function(s){return state.ownedSkins[s.id];});
    var ownedP=premiumSkins.filter(function(s){return state.ownedPremiumSkins[s.id];});
    var ownedF=fonts.filter(function(f){return state.ownedFonts[f.id];});
    var ownedL=logos.filter(function(l){return state.ownedLogos[l.id];});
    var ownedI=iconSets.filter(function(s){return state.ownedIconSets[s.id];});
    var ownedC=coinSkins.filter(function(s){return state.ownedCoinSkins[s.id];});
    var ownedT=templates.filter(function(t){return state.ownedTemplates[t.id];});
    if(ownedS.length) cats.push({key:'basic',label:'<i class="fas fa-palette"></i> Basic Skins',items:ownedS,render:function(s){var a=state.activeSkin===s.id;return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div class="skin-preview-inner" style="color:#333;background:#fff;">Preview</div></div><div class="skin-card-body" style="background:'+s.cardBg+';"><h4 style="color:'+s.cardText+';">'+s.name+'</h4><p style="color:'+s.cardMuted+';">'+s.desc+'</p><button class="btn '+(a?'btn-disabled':'btn-primary')+' apply-skin-btn" data-sid="'+s.id+'">'+(a?'Active':'Apply')+'</button></div></div>';},defaultCard:'<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);"><div class="skin-preview-inner" style="color:#333;background:#fff;">Default</div></div><div class="skin-card-body"><h4>Default</h4><p>The BlipVibe signature look.</p><button class="btn '+(!state.activeSkin?'btn-disabled':'btn-primary')+' apply-skin-btn" data-sid="default">'+(!state.activeSkin?'Active':'Apply')+'</button></div></div>'});
    if(ownedP.length) cats.push({key:'premium',label:'<i class="fas fa-gem"></i> Premium Skins',items:ownedP,render:function(s){var a=state.activePremiumSkin===s.id;return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div class="premium-preview-frame" style="background:'+s.border+';"><img src="images/default-avatar.svg" class="premium-preview-avatar"></div></div><div class="skin-card-body"><h4><i class="fas '+s.icon+'" style="color:'+s.iconColor+';margin-right:6px;"></i>'+s.name+'</h4><p>'+s.desc+'</p><button class="btn '+(a?'btn-disabled':'btn-primary')+' apply-premium-btn" data-pid="'+s.id+'">'+(a?'Active':'Apply')+'</button></div></div>';},defaultCard:'<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);"><div style="color:#fff;font-size:14px;font-weight:600;">Default</div></div><div class="skin-card-body"><h4>Default</h4><p>The BlipVibe signature look.</p><button class="btn '+(!state.activePremiumSkin?'btn-disabled':'btn-primary')+' apply-premium-btn" data-pid="default">'+(!state.activePremiumSkin?'Active':'Apply')+'</button></div></div>'});
    if(ownedF.length) cats.push({key:'fonts',label:'<i class="fas fa-font"></i> Font Styles',items:ownedF,render:function(f){var a=state.activeFont===f.id;return '<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#667eea,#764ba2);"><span style="font-family:\''+f.family+'\',sans-serif;color:#fff;font-size:24px;">Aa Bb Cc</span></div><div class="skin-card-body"><h4 style="font-family:\''+f.family+'\',sans-serif;">'+f.name+'</h4><p>'+f.desc+'</p><button class="btn '+(a?'btn-disabled':'btn-primary')+' apply-font-btn" data-fid="'+f.id+'">'+(a?'Active':'Apply')+'</button></div></div>';},defaultCard:'<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#667eea,#764ba2);"><span style="font-family:Roboto,sans-serif;color:#fff;font-size:24px;">Aa Bb Cc</span></div><div class="skin-card-body"><h4>Default (Roboto)</h4><p>The original BlipVibe font.</p><button class="btn '+(!state.activeFont?'btn-disabled':'btn-primary')+' apply-font-btn" data-fid="default">'+(!state.activeFont?'Active':'Apply')+'</button></div></div>'});
    if(ownedL.length) cats.push({key:'logos',label:'<i class="fas fa-star"></i> Logo Styles',items:ownedL,render:function(l){var a=state.activeLogo===l.id;return '<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#f093fb,#f5576c);"><span style="color:#fff;font-size:22px;font-weight:700;">'+l.text+'</span></div><div class="skin-card-body"><h4>'+l.name+'</h4><p>'+l.desc+'</p><button class="btn '+(a?'btn-disabled':'btn-primary')+' apply-logo-btn" data-lid="'+l.id+'">'+(a?'Active':'Apply')+'</button></div></div>';},defaultCard:'<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#f093fb,#f5576c);"><span style="color:#fff;font-size:22px;font-weight:700;">BlipVibe</span></div><div class="skin-card-body"><h4>Default</h4><p>The original BlipVibe logo.</p><button class="btn '+(!state.activeLogo?'btn-disabled':'btn-primary')+' apply-logo-btn" data-lid="default">'+(!state.activeLogo?'Active':'Apply')+'</button></div></div>'});
    if(ownedI.length) cats.push({key:'icons',label:'<i class="fas fa-icons"></i> Icon Sets',items:ownedI,render:function(s){var a=state.activeIconSet===s.id;var prev='';Object.keys(s.icons).slice(0,4).forEach(function(k){prev+='<i class="fas '+s.icons[k]+'" style="margin:0 4px;font-size:18px;"></i>';});return '<div class="skin-card"><div class="skin-preview" style="background:'+s.preview+';"><div style="color:#fff;">'+prev+'</div></div><div class="skin-card-body"><h4>'+s.name+'</h4><p>'+s.desc+'</p><button class="btn '+(a?'btn-disabled':'btn-primary')+' apply-icon-btn" data-iid="'+s.id+'">'+(a?'Active':'Apply')+'</button></div></div>';},defaultCard:'<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);"><div style="color:#fff;"><i class="fas fa-home" style="margin:0 4px;font-size:18px;"></i><i class="fas fa-users-rectangle" style="margin:0 4px;font-size:18px;"></i><i class="fas fa-palette" style="margin:0 4px;font-size:18px;"></i><i class="fas fa-store" style="margin:0 4px;font-size:18px;"></i></div></div><div class="skin-card-body"><h4>Default</h4><p>The original BlipVibe icons.</p><button class="btn '+(!state.activeIconSet?'btn-disabled':'btn-primary')+' apply-icon-btn" data-iid="default">'+(!state.activeIconSet?'Active':'Apply')+'</button></div></div>'});
    if(ownedC.length) cats.push({key:'coins',label:'<i class="fas fa-coins"></i> Coin Skins',items:ownedC,render:function(s){var a=state.activeCoinSkin===s.id;return '<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#1a1a2e,#16213e);"><i class="fas '+s.icon+'" style="font-size:36px;color:'+s.color+';"></i></div><div class="skin-card-body"><h4>'+s.name+'</h4><p>'+s.desc+'</p><button class="btn '+(a?'btn-disabled':'btn-primary')+' apply-coin-btn" data-cid="'+s.id+'">'+(a?'Active':'Apply')+'</button></div></div>';},defaultCard:'<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#1a1a2e,#16213e);"><i class="fas fa-coins" style="font-size:36px;color:#ffd700;"></i></div><div class="skin-card-body"><h4>Default</h4><p>The original gold coins.</p><button class="btn '+(!state.activeCoinSkin?'btn-disabled':'btn-primary')+' apply-coin-btn" data-cid="default">'+(!state.activeCoinSkin?'Active':'Apply')+'</button></div></div>'});
    if(ownedT.length) cats.push({key:'templates',label:'<i class="fas fa-table-columns"></i> Templates',items:ownedT,render:function(t){var a=state.activeTemplate===t.id;return '<div class="skin-card"><div class="skin-preview" style="background:'+t.preview+';"><i class="fas fa-table-columns" style="font-size:36px;color:rgba(255,255,255,.9);"></i></div><div class="skin-card-body"><h4>'+t.name+'</h4><p>'+t.desc+'</p><button class="btn '+(a?'btn-disabled':'btn-primary')+' apply-tpl-btn" data-tid="'+t.id+'">'+(a?'Active':'Apply')+'</button></div></div>';},defaultCard:'<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);"><i class="fas fa-table-columns" style="font-size:36px;color:rgba(255,255,255,.9);"></i></div><div class="skin-card-body"><h4>Default Template</h4><p>Wide feed, narrow sidebars.</p><button class="btn '+(state.activeTemplate==='spotlight'?'btn-disabled':'btn-primary')+' apply-tpl-btn" data-tid="spotlight">'+(state.activeTemplate==='spotlight'?'Active':'Apply')+'</button></div></div>'});
    var ownedN=navStyles.filter(function(n){return state.ownedNavStyles[n.id];});
    if(ownedN.length) cats.push({key:'navstyles',label:'<i class="fas fa-bars-staggered"></i> Nav Styles',items:ownedN,render:function(n){var a=state.activeNavStyle===n.id;return '<div class="skin-card"><div class="skin-preview" style="background:'+n.preview+';"><i class="fas fa-bars-staggered" style="font-size:36px;color:rgba(255,255,255,.9);"></i></div><div class="skin-card-body"><h4>'+n.name+'</h4><p>'+n.desc+'</p><button class="btn '+(a?'btn-disabled':'btn-primary')+' apply-nav-btn" data-nid="'+n.id+'">'+(a?'Active':'Apply')+'</button></div></div>';},defaultCard:'<div class="skin-card"><div class="skin-preview" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);"><i class="fas fa-bars-staggered" style="font-size:36px;color:rgba(255,255,255,.9);"></i></div><div class="skin-card-body"><h4>Default</h4><p>The original top navigation bar.</p><button class="btn '+(!state.activeNavStyle?'btn-disabled':'btn-primary')+' apply-nav-btn" data-nid="default">'+(!state.activeNavStyle?'Active':'Apply')+'</button></div></div>'});
    return cats;
}
function renderMySkins(){
    var cats=getMySkinCategories();
    if(!cats.length){
        $('#mySkinsTabs').innerHTML='';
        $('#mySkinsGrid').innerHTML='<div class="empty-state"><i class="fas fa-palette"></i><p>You don\'t own anything yet.</p><button class="btn btn-primary" data-page="shop">Visit Shop</button></div>';
        return;
    }
    if(!currentMySkinsTab||!cats.find(function(c){return c.key===currentMySkinsTab;})) currentMySkinsTab=cats[0].key;
    var tabsHtml='';
    cats.forEach(function(c){tabsHtml+='<button class="search-tab'+(c.key===currentMySkinsTab?' active':'')+'" data-mtab="'+c.key+'">'+c.label+'</button>';});
    $('#mySkinsTabs').innerHTML=tabsHtml;
    var active=cats.find(function(c){return c.key===currentMySkinsTab;});
    var html='<div class="shop-scroll-row scroll-2row">';
    if(active.defaultCard) html+=active.defaultCard;
    active.items.forEach(function(item){html+=active.render(item);});
    html+='</div>';
    // Premium background controls (only on premium tab with active premium skin)
    if(currentMySkinsTab==='premium'&&state.activePremiumSkin){
        var bgHtml='<div class="premium-bg-controls" style="margin-top:16px;padding:16px;background:var(--card);border-radius:12px;box-shadow:var(--shadow);">';
        bgHtml+='<h4 style="margin-bottom:10px;font-size:14px;"><i class="fas fa-image" style="margin-right:6px;color:var(--primary);"></i>Background Image</h4>';
        bgHtml+='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">';
        bgHtml+='<label class="btn btn-primary" style="cursor:pointer;font-size:13px;"><i class="fas fa-upload" style="margin-right:6px;"></i>Upload<input type="file" id="premiumBgUpload" accept="image/*" style="display:none;"></label>';
        if(premiumBgImage){
            bgHtml+='<button class="btn" id="premiumBgRemove" style="font-size:13px;background:var(--border);color:var(--dark);"><i class="fas fa-trash" style="margin-right:6px;"></i>Remove</button>';
            bgHtml+='<img src="'+premiumBgImage+'" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:2px solid var(--border);">';
        }
        bgHtml+='</div>';
        if(premiumBgImage){
            bgHtml+='<div style="margin-top:12px;">';
            bgHtml+='<label style="font-size:12px;color:var(--gray);display:flex;align-items:center;gap:8px;"><i class="fas fa-sliders"></i>Saturation: <span id="satValLabel">'+premiumBgSaturation+'%</span></label>';
            bgHtml+='<input type="range" id="premiumBgSatSlider" min="0" max="200" value="'+premiumBgSaturation+'" style="width:100%;margin-top:6px;accent-color:var(--primary);">';
            bgHtml+='</div>';
        }
        bgHtml+='</div>';
        html+=bgHtml;
    }
    $('#mySkinsGrid').innerHTML=html;
    // Premium bg upload handler
    var bgUploadInput=document.getElementById('premiumBgUpload');
    if(bgUploadInput){
        bgUploadInput.addEventListener('change',async function(){
            var file=bgUploadInput.files[0];if(!file||!currentUser)return;
            // Upload to Supabase Storage for persistence and sharing
            try{
                var ext=file.name.split('.').pop()||'jpg';
                var path='backgrounds/'+currentUser.id+'/bg.'+ext;
                var url=await sbUploadFile('avatars',path,file);
                premiumBgImage=url;
                updatePremiumBg();renderMySkins();saveState();
            }catch(e){
                console.warn('BG upload to storage failed, using local:',e);
                // Fallback to base64 for local preview
                var reader=new FileReader();
                reader.onload=function(ev){premiumBgImage=ev.target.result;updatePremiumBg();renderMySkins();saveState();};
                reader.readAsDataURL(file);
            }
        });
    }
    var bgRemoveBtn=document.getElementById('premiumBgRemove');
    if(bgRemoveBtn){
        bgRemoveBtn.addEventListener('click',function(){premiumBgImage=null;premiumBgSaturation=100;updatePremiumBg();renderMySkins();saveState();});
    }
    var satSlider=document.getElementById('premiumBgSatSlider');
    if(satSlider){
        satSlider.addEventListener('input',function(){
            premiumBgSaturation=parseInt(satSlider.value);
            document.getElementById('satValLabel').textContent=premiumBgSaturation+'%';
            updatePremiumBg();
        });
        satSlider.addEventListener('change',function(){saveState();});
    }
    function mySkinsRerender(){var row=$('#mySkinsGrid .shop-scroll-row');var sl=row?row.scrollLeft:0;renderMySkins();var row2=$('#mySkinsGrid .shop-scroll-row');if(row2)row2.scrollLeft=sl;saveState();}
    $$('#mySkinsGrid .apply-skin-btn').forEach(function(btn){btn.addEventListener('click',function(){applySkin(btn.dataset.sid==='default'?null:btn.dataset.sid);mySkinsRerender();});});
    $$('#mySkinsGrid .apply-font-btn').forEach(function(btn){btn.addEventListener('click',function(){applyFont(btn.dataset.fid==='default'?null:btn.dataset.fid);mySkinsRerender();});});
    $$('#mySkinsGrid .apply-logo-btn').forEach(function(btn){btn.addEventListener('click',function(){applyLogo(btn.dataset.lid==='default'?null:btn.dataset.lid);mySkinsRerender();});});
    $$('#mySkinsGrid .apply-icon-btn').forEach(function(btn){btn.addEventListener('click',function(){applyIconSet(btn.dataset.iid==='default'?null:btn.dataset.iid);mySkinsRerender();});});
    $$('#mySkinsGrid .apply-coin-btn').forEach(function(btn){btn.addEventListener('click',function(){applyCoinSkin(btn.dataset.cid==='default'?null:btn.dataset.cid);mySkinsRerender();});});
    $$('#mySkinsGrid .apply-tpl-btn').forEach(function(btn){btn.addEventListener('click',function(){applyTemplate(btn.dataset.tid==='default'?null:btn.dataset.tid);mySkinsRerender();});});
    $$('#mySkinsGrid .apply-premium-btn').forEach(function(btn){btn.addEventListener('click',function(){applyPremiumSkin(btn.dataset.pid==='default'?null:btn.dataset.pid);mySkinsRerender();});});
    $$('#mySkinsGrid .apply-nav-btn').forEach(function(btn){btn.addEventListener('click',function(){applyNavStyle(btn.dataset.nid==='default'?null:btn.dataset.nid);mySkinsRerender();});});
    initDragScroll('#mySkinsGrid');
    $$('#mySkinsTabs .search-tab').forEach(function(tab){tab.addEventListener('click',function(){
        $$('#mySkinsTabs .search-tab').forEach(function(t){t.classList.remove('active');});
        tab.classList.add('active');currentMySkinsTab=tab.dataset.mtab;renderMySkins();
    });});
}

// ======================== MESSAGES (Supabase) ========================
var activeChat=null; // { partnerId, partner: {id,username,display_name,avatar_url} }
var msgConversations=[];

async function loadConversations(){
    if(!currentUser) return;
    try{
        msgConversations=await sbGetConversations(currentUser.id);
    }catch(e){console.error('loadConversations:',e);msgConversations=[];}
    renderMsgContacts();
    updateMsgBadge();
}
function updateMsgBadge(){
    var total=0;
    msgConversations.forEach(function(c){total+=c.unread||0;});
    var badge=$('#msgBadge');
    if(badge){
        if(total>0){badge.style.display='flex';badge.textContent=total;}
        else{badge.style.display='none';}
    }
}

function renderMsgContacts(search){
    var list=$('#msgContactList');
    if(!list) return;
    var convos=msgConversations;
    if(search){
        var q=search.toLowerCase();
        convos=convos.filter(function(c){
            var name=(c.partner.display_name||c.partner.username||'').toLowerCase();
            return name.indexOf(q)!==-1;
        });
    }
    if(!convos.length){
        list.innerHTML='<div class="empty-state" style="padding:40px 20px;"><i class="fas fa-envelope-open-text"></i><p>No messages yet.</p></div>';
        return;
    }
    var html='';
    convos.forEach(function(c){
        var name=c.partner.display_name||c.partner.username||'User';
        var avatar=c.partner.avatar_url||DEFAULT_AVATAR;
        var preview=c.lastMessage.content||'';
        if(/^\[img\]/.test(preview)) preview='Sent an image';
        else if(preview.length>40) preview=preview.substring(0,40)+'...';
        var time=timeAgoReal(c.lastMessage.created_at);
        var isActive=activeChat&&activeChat.partnerId===c.partnerId;
        html+='<div class="msg-contact'+(isActive?' active':'')+'" data-partner-id="'+c.partnerId+'">';
        html+='<img src="'+avatar+'" alt="'+name+'" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;">';
        html+='<div class="msg-contact-info"><div class="msg-contact-name">'+name+(c.unread>0?' <span style="background:var(--primary);color:#fff;font-size:11px;padding:1px 7px;border-radius:10px;margin-left:6px;">'+c.unread+'</span>':'')+'</div>';
        html+='<div class="msg-contact-preview">'+preview+'</div></div>';
        html+='<span class="msg-contact-time">'+time+'</span>';
        html+='</div>';
    });
    list.innerHTML=html;
    // Click to open chat
    list.querySelectorAll('.msg-contact').forEach(function(el){
        el.addEventListener('click',function(){
            var pid=el.getAttribute('data-partner-id');
            var convo=msgConversations.find(function(c){return c.partnerId===pid;});
            if(convo) openChat({partnerId:convo.partnerId,partner:convo.partner});
        });
    });
}

async function openChat(contact){
    activeChat=contact;
    renderMsgContacts();
    var name=contact.partner.display_name||contact.partner.username||'User';
    var avatar=contact.partner.avatar_url||DEFAULT_AVATAR;
    var html='<div class="msg-chat-header"><img src="'+avatar+'" alt="'+name+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;cursor:pointer;" data-uid="'+contact.partnerId+'"><h4>'+name+'</h4></div>';
    html+='<div class="msg-chat-messages" id="chatMessages"><div style="text-align:center;padding:20px;color:var(--gray);"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
    html+='<div class="msg-chat-input"><button id="msgImgBtn" title="Send image" style="background:none;border:none;color:var(--primary);font-size:18px;padding:8px;cursor:pointer;"><i class="fas fa-image"></i></button><input type="file" id="msgImgInput" accept="image/*" style="display:none;"><input type="text" placeholder="Type a message..." id="msgInput" style="flex:1;"><button id="sendMsgBtn"><i class="fas fa-paper-plane"></i></button></div>';
    $('#msgChat').innerHTML=html;

    // Load messages
    try{
        var messages=await sbGetMessages(currentUser.id,contact.partnerId);
        var msgArea=$('#chatMessages');
        if(!messages||!messages.length){
            msgArea.innerHTML='<div style="text-align:center;padding:40px;color:var(--gray);"><p>No messages yet. Say hello!</p></div>';
        } else {
            var mhtml='';
            messages.forEach(function(m){
                var isMine=m.sender_id===currentUser.id;
                var content=m.content;
                // Render image messages
                var imgMatch=content.match(/^\[img\](.*?)\[\/img\]$/);
                if(imgMatch){content='<img src="'+imgMatch[1]+'" style="max-width:200px;border-radius:8px;">';}
                mhtml+='<div class="msg-bubble '+(isMine?'sent':'received')+'">'+content+'</div>';
            });
            msgArea.innerHTML=mhtml;
            msgArea.scrollTop=msgArea.scrollHeight;
        }
        // Mark as read
        await sbMarkMessagesRead(currentUser.id,contact.partnerId);
        var convo=msgConversations.find(function(c){return c.partnerId===contact.partnerId;});
        if(convo) convo.unread=0;
        renderMsgContacts();
        updateMsgBadge();
    }catch(e){
        console.error('Load messages:',e);
        $('#chatMessages').innerHTML='<div style="text-align:center;padding:40px;color:#e74c3c;"><p>Failed to load messages.</p></div>';
    }

    // Send handler
    $('#sendMsgBtn').addEventListener('click',sendMessage);
    $('#msgInput').addEventListener('keypress',function(e){if(e.key==='Enter')sendMessage();});
    $('#msgInput').focus();

    // Image send handler
    $('#msgImgBtn').addEventListener('click',function(){$('#msgImgInput').click();});
    $('#msgImgInput').addEventListener('change',async function(){
        var file=this.files[0];if(!file||!activeChat||!currentUser) return;
        try{
            var path=currentUser.id+'/msg-'+Date.now()+'-'+file.name;
            var url=await sbUploadFile('posts',path,file);
            var imgContent='[img]'+url+'[/img]';
            var msgArea=$('#chatMessages');
            var placeholder=msgArea.querySelector('div[style*="text-align:center"]');
            if(placeholder&&placeholder.textContent.indexOf('No messages')!==-1) msgArea.innerHTML='';
            msgArea.insertAdjacentHTML('beforeend','<div class="msg-bubble sent"><img src="'+url+'" style="max-width:200px;border-radius:8px;"></div>');
            msgArea.scrollTop=msgArea.scrollHeight;
            await sbSendMessage(currentUser.id,activeChat.partnerId,imgContent);
            await loadConversations();
        }catch(e){console.error('Send image:',e);showToast('Failed to send image');}
        this.value='';
    });

    // Click avatar to view profile
    var avatarEl=$('#msgChat').querySelector('.msg-chat-header img');
    if(avatarEl) avatarEl.addEventListener('click',async function(){
        try{var p=await sbGetProfile(contact.partnerId);if(p)showProfileView(profileToPerson(p));}catch(e){}
    });
}

async function sendMessage(){
    var input=$('#msgInput');
    if(!input) return;
    var text=input.value.trim();
    if(!text||!activeChat||!currentUser) return;
    input.value='';
    // Optimistically show the message
    var msgArea=$('#chatMessages');
    var placeholder=msgArea.querySelector('div[style*="text-align:center"]');
    if(placeholder&&placeholder.textContent.indexOf('No messages')!==-1) msgArea.innerHTML='';
    msgArea.insertAdjacentHTML('beforeend','<div class="msg-bubble sent">'+text+'</div>');
    msgArea.scrollTop=msgArea.scrollHeight;
    try{
        await sbSendMessage(currentUser.id,activeChat.partnerId,text);
        // Update conversation list
        await loadConversations();
    }catch(e){
        console.error('Send message:',e);
        showToast('Message failed to send');
    }
}

// Start a conversation from a profile (called by Message buttons)
function startConversation(userId, userName, userAvatar){
    navigateTo('messages');
    setTimeout(function(){
        openChat({partnerId:userId,partner:{id:userId,display_name:userName,username:userName,avatar_url:userAvatar}});
    },100);
}

$('#msgSearch').addEventListener('input',function(){renderMsgContacts(this.value);});

// Subscribe to realtime messages
function initMessageSubscription(){
    if(!currentUser) return;
    sbSubscribeMessages(currentUser.id, function(newMsg){
        // Reload conversations to update sidebar
        loadConversations();
        // If we're in the chat with this sender, append the message
        if(activeChat&&activeChat.partnerId===newMsg.sender_id){
            var msgArea=$('#chatMessages');
            if(msgArea){
                var content=newMsg.content;
                if(/^\[img\]/.test(content)){
                    var imgUrl=content.replace('[img]','').replace('[/img]','');
                    msgArea.insertAdjacentHTML('beforeend','<div class="msg-bubble received"><img src="'+imgUrl+'" style="max-width:200px;border-radius:8px;cursor:pointer;" onclick="window.open(this.src)"></div>');
                } else {
                    msgArea.insertAdjacentHTML('beforeend','<div class="msg-bubble received">'+content+'</div>');
                }
                msgArea.scrollTop=msgArea.scrollHeight;
                // Mark as read immediately
                sbMarkMessagesRead(currentUser.id,newMsg.sender_id).catch(function(){});
            }
        } else {
            // Not viewing this chat — show notification
            sbGetProfile(newMsg.sender_id).then(function(sender){
                var senderName=sender?(sender.display_name||sender.username):'Someone';
                var preview=/^\[img\]/.test(newMsg.content)?'sent an image':newMsg.content.substring(0,40);
                addNotification('message',senderName+': '+preview);
            }).catch(function(){
                addNotification('message','New message received');
            });
        }
    });
}

// ======================== PHOTOS ========================
function getAllPhotos(){
    var all=state.photos.profile.concat(state.photos.cover,state.photos.post);
    state.photos.albums.forEach(function(a){all=all.concat(a.photos);});
    return all;
}
function renderPhotosCard(){
    var all=getAllPhotos();
    var el=$('#photosPreview');
    if(!all.length){el.innerHTML='<p class="photos-empty">No photos yet</p>';return;}
    var html='';
    all.slice(0,6).forEach(function(p){html+='<img src="'+p.src+'">';});
    el.innerHTML=html;
}
function renderPhotoAlbum(){
    var html='<div style="display:flex;justify-content:flex-end;margin-bottom:16px;"><button class="btn btn-primary" id="createAlbumBtn"><i class="fas fa-plus"></i> Create Album</button></div>';
    // Profile Pictures
    html+='<div class="photo-album-section"><h3><i class="fas fa-user-circle"></i> Profile Pictures</h3>';
    if(state.photos.profile.length){html+='<div class="photo-album-grid">';state.photos.profile.forEach(function(p){html+='<img src="'+p.src+'">';});html+='</div>';}
    else html+='<p class="photo-album-empty">No profile pictures yet. Upload a profile or cover photo!</p>';
    html+='</div>';
    // Cover Photos
    html+='<div class="photo-album-section"><h3><i class="fas fa-panorama"></i> Cover Photos</h3>';
    if(state.photos.cover.length){html+='<div class="photo-album-grid">';state.photos.cover.forEach(function(p){html+='<img src="'+p.src+'">';});html+='</div>';}
    else html+='<p class="photo-album-empty">No cover photos yet.</p>';
    html+='</div>';
    // Post Photos
    html+='<div class="photo-album-section"><h3><i class="fas fa-newspaper"></i> Post Photos</h3>';
    if(state.photos.post.length){html+='<div class="photo-album-grid">';state.photos.post.forEach(function(p){html+='<img src="'+p.src+'">';});html+='</div>';}
    else html+='<p class="photo-album-empty">No post photos yet. Create a post with images!</p>';
    html+='</div>';
    // Custom Albums
    state.photos.albums.forEach(function(album,ai){
        html+='<div class="photo-album-section"><h3><i class="fas fa-folder"></i> '+album.name+' <button class="btn btn-primary album-add-btn" data-ai="'+ai+'" style="padding:4px 12px;font-size:12px;margin-left:8px;"><i class="fas fa-plus"></i> Add</button></h3>';
        if(album.photos.length){html+='<div class="photo-album-grid">';album.photos.forEach(function(p){html+='<img src="'+p.src+'">';});html+='</div>';}
        else html+='<p class="photo-album-empty">No photos in this album yet.</p>';
        html+='</div>';
    });
    $('#photoAlbumContent').innerHTML=html;
    // Lightbox handled by delegated click listener
    $('#createAlbumBtn').addEventListener('click',function(){
        var mHtml='<div class="modal-header"><h3>Create Album</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
        mHtml+='<div class="modal-body"><label style="display:block;font-size:14px;font-weight:500;margin-bottom:6px;">Album Name</label><input type="text" id="albumNameInput" placeholder="My Album" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;margin-bottom:16px;font-family:inherit;">';
        mHtml+='<button class="btn btn-primary" id="albumCreateConfirm" style="width:100%;">Create</button></div>';
        showModal(mHtml);
        document.getElementById('albumCreateConfirm').addEventListener('click',function(){
            var name=document.getElementById('albumNameInput').value.trim();
            if(!name)return;
            state.photos.albums.push({name:name,photos:[]});
            closeModal();renderPhotoAlbum();renderPhotosCard();
        });
    });
    $$('.album-add-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            var ai=parseInt(btn.dataset.ai);
            var input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=true;
            input.addEventListener('change',function(){
                Array.from(input.files).forEach(function(f){
                    var r=new FileReader();
                    r.onload=function(e){state.photos.albums[ai].photos.unshift({src:e.target.result,date:Date.now()});renderPhotoAlbum();renderPhotosCard();};
                    r.readAsDataURL(f);
                });
            });
            input.click();
        });
    });
}
$('#viewAllPhotos').addEventListener('click',function(e){e.preventDefault();renderPhotoAlbum();navigateTo('photos');});
$$('.photos-back-link').forEach(function(l){l.addEventListener('click',function(e){e.preventDefault();navigateTo(_navPrev&&_navPrev!=='photos'?_navPrev:'home');});});

// ======================== SAVE POST MODAL ========================
function showSaveModal(pid){
    var existing=findPostFolder(pid);
    var h='<div class="modal-header"><h3><i class="fas fa-bookmark" style="color:var(--primary);margin-right:8px;"></i>'+(existing?'Move Post':'Save Post')+'</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    h+='<div class="modal-body">';
    if(existing) h+='<p style="font-size:13px;color:var(--gray);margin-bottom:12px;">Currently in: <strong>'+existing.name+'</strong></p>';
    h+='<p style="font-size:14px;font-weight:600;margin-bottom:10px;">Add to Folder</p>';
    h+='<div id="saveFolderList" style="display:flex;flex-direction:column;gap:6px;">';
    savedFolders.forEach(function(f){
        var inThis=existing&&existing.id===f.id;
        h+='<button class="btn '+(inThis?'btn-disabled':'btn-outline')+' save-folder-pick" data-fid="'+f.id+'" style="text-align:left;justify-content:flex-start;display:flex;align-items:center;gap:8px;"><i class="fas fa-folder" style="color:var(--primary);"></i>'+f.name+(inThis?' <span style="margin-left:auto;font-size:11px;color:var(--gray);">Current</span>':'')+'</button>';
    });
    h+='<button class="btn btn-outline" id="saveNewFolderBtn" style="text-align:left;display:flex;align-items:center;gap:8px;"><i class="fas fa-folder-plus" style="color:var(--green);"></i>+ Create New Folder</button>';
    h+='<div id="saveNewFolderInput" style="display:none;margin-top:6px;"><div style="display:flex;gap:8px;"><input type="text" id="saveNewFolderName" placeholder="Folder name..." style="flex:1;padding:8px 12px;border:2px solid var(--border);border-radius:8px;font-size:14px;"><button class="btn btn-primary" id="saveNewFolderConfirm" style="padding:8px 16px;">Add</button></div></div>';
    h+='</div></div>';
    showModal(h);
    // Bind folder picks
    $$('#saveFolderList .save-folder-pick').forEach(function(btn){
        btn.addEventListener('click',function(){
            if(btn.classList.contains('btn-disabled')) return;
            savePostToFolder(pid,btn.dataset.fid);
            closeModal();
            showToast('Post saved to '+savedFolders.find(function(f){return f.id===btn.dataset.fid;}).name);
        });
    });
    document.getElementById('saveNewFolderBtn').addEventListener('click',function(){
        document.getElementById('saveNewFolderInput').style.display='block';
        document.getElementById('saveNewFolderName').focus();
    });
    document.getElementById('saveNewFolderConfirm').addEventListener('click',function(){
        var name=document.getElementById('saveNewFolderName').value.trim();
        if(!name) return;
        var fid='folder-'+Date.now();
        savedFolders.push({id:fid,name:name,posts:[]});
        savePostToFolder(pid,fid);
        closeModal();
        showToast('Post saved to '+name);
    });
}
function savePostToFolder(pid,fid){
    var s=String(pid);
    // Remove from any existing folder
    savedFolders.forEach(function(f){var idx=f.posts.indexOf(s);if(idx!==-1)f.posts.splice(idx,1);});
    // Add to target
    var target=savedFolders.find(function(f){return f.id===fid;});
    if(target) target.posts.push(s);
    persistSaved();
}

// ======================== REPORT MODAL ========================
function showReportModal(pid){
    var h='<div class="modal-header"><h3><i class="fas fa-flag" style="color:#e74c3c;margin-right:8px;"></i>Report Post</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    h+='<div class="modal-body"><p style="font-size:14px;margin-bottom:14px;color:var(--gray);">Why are you reporting this post?</p>';
    h+='<div style="display:flex;flex-direction:column;gap:8px;">';
    ['Spam','Abuse','Other'].forEach(function(r){
        h+='<button class="btn btn-outline report-reason-btn" data-reason="'+r+'" style="text-align:left;">'+r+'</button>';
    });
    h+='</div></div>';
    showModal(h);
    $$('.report-reason-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            reportedPosts.push({pid:pid,reason:btn.dataset.reason,time:Date.now()});
            persistReports();
            closeModal();
            showToast('Report submitted. Thank you.');
        });
    });
}

// ======================== HIDE POST ========================
function hidePost(pid){
    hiddenPosts[pid]=true;
    persistHidden();
    renderFeed(activeFeedTab);
    showUndoToast('Post hidden from your feed',function(){
        delete hiddenPosts[pid];
        persistHidden();
        renderFeed(activeFeedTab);
    });
}
function unhidePost(pid){
    delete hiddenPosts[pid];
    persistHidden();
}
function showHiddenPostsModal(){
    var pids=Object.keys(hiddenPosts);
    var h='<div class="modal-header"><h3><i class="fas fa-eye-slash" style="color:var(--primary);margin-right:8px;"></i>Hidden Posts ('+pids.length+')</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    h+='<div class="modal-body" style="max-height:60vh;overflow-y:auto;">';
    if(!pids.length){
        h+='<p style="text-align:center;color:var(--gray);padding:20px;">No hidden posts.</p>';
    } else {
        pids.forEach(function(pid){
            var p=feedPosts.find(function(fp){return String(fp.idx)===String(pid);});
            if(!p) return;
            var short=p.text.substring(0,100)+(p.text.length>100?'...':'');
            h+='<div class="hidden-post-item" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">';
            h+='<img src="'+(p.person.img||p.person.avatar_url||DEFAULT_AVATAR)+'" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;">';
            h+='<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;">'+p.person.name+'</div><p style="font-size:12px;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+short+'</p></div>';
            h+='<button class="btn btn-outline unhide-btn" data-pid="'+pid+'" style="padding:6px 14px;font-size:12px;flex-shrink:0;"><i class="fas fa-eye"></i> Unhide</button>';
            h+='</div>';
        });
    }
    h+='</div>';
    showModal(h);
    $$('.unhide-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            unhidePost(btn.dataset.pid);
            showHiddenPostsModal();
            renderFeed(activeFeedTab);
        });
    });
}

// ======================== BLOCK USER SYSTEM ========================
function showBlockConfirmModal(person,onDone){
    var h='<div class="modal-header"><h3><i class="fas fa-ban" style="color:#e74c3c;margin-right:8px;"></i>Block '+person.name+'?</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    h+='<div class="modal-body">';
    h+='<p style="color:var(--gray);font-size:14px;text-align:center;margin-bottom:16px;">They won\'t be able to see your posts or interact with you. Their posts will be hidden from your feed.</p>';
    h+='<div class="modal-actions"><button class="btn btn-outline modal-close">Cancel</button><button class="btn" id="confirmBlockBtn" style="background:#e74c3c;color:#fff;"><i class="fas fa-ban"></i> Block</button></div>';
    h+='</div>';
    showModal(h);
    document.getElementById('confirmBlockBtn').addEventListener('click',function(){
        blockUser(person.id);
        closeModal();
        if(onDone) onDone();
    });
}
function blockUser(uid){
    blockedUsers[uid]=true;
    persistBlocked();
    // Unfollow them if following
    if(state.followedUsers[uid]){
        delete state.followedUsers[uid];
    }
    // Remove from my followers
    var idx=myFollowers.indexOf(uid);
    if(idx!==-1){myFollowers.splice(idx,1);}
    updateFollowCounts();
    renderFeed(activeFeedTab);
    showToast('User blocked');
}
function unblockUser(uid){
    delete blockedUsers[uid];
    persistBlocked();
    renderFeed(activeFeedTab);
    showToast('User unblocked');
}
async function showBlockedUsersModal(){
    var uids=Object.keys(blockedUsers);
    var h='<div class="modal-header"><h3><i class="fas fa-ban" style="color:#e74c3c;margin-right:8px;"></i>Blocked Users ('+uids.length+')</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    h+='<div class="modal-body" style="max-height:60vh;overflow-y:auto;">';
    if(!uids.length){
        h+='<p style="text-align:center;color:var(--gray);padding:20px;">No blocked users.</p>';
    } else {
        for(var i=0;i<uids.length;i++){
            var uid=uids[i];
            var name='User';var bio='';var avatar=DEFAULT_AVATAR;
            try{var p=await sbGetProfile(uid);if(p){name=p.display_name||p.username||'User';bio=p.bio||'';avatar=p.avatar_url||DEFAULT_AVATAR;}}catch(e){}
            h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">';
            h+='<img src="'+avatar+'" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;">';
            h+='<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;">'+name+'</div><p style="font-size:12px;color:var(--gray);">'+bio+'</p></div>';
            h+='<button class="btn btn-outline unblock-btn" data-uid="'+uid+'" style="padding:6px 14px;font-size:12px;flex-shrink:0;color:#e74c3c;border-color:#e74c3c;"><i class="fas fa-unlock"></i> Unblock</button>';
            h+='</div>';
        }
    }
    h+='</div>';
    showModal(h);
    $$('.unblock-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            unblockUser(btn.dataset.uid);
            showBlockedUsersModal();
        });
    });
}

// ======================== TOAST NOTIFICATION ========================
function showToast(msg){
    var t=document.createElement('div');
    t.className='dq-toast';
    t.textContent=msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){t.classList.add('show');});
    setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove();},300);},2500);
}
function showUndoToast(msg,onUndo){
    $$('.dq-toast').forEach(function(el){el.remove();});
    var t=document.createElement('div');
    t.className='dq-toast dq-toast-undo';
    t.innerHTML='<span>'+msg+'</span><button class="dq-toast-undo-btn">Undo</button>';
    document.body.appendChild(t);
    var timer;
    t.querySelector('.dq-toast-undo-btn').addEventListener('click',function(){
        clearTimeout(timer);
        t.classList.remove('show');
        setTimeout(function(){t.remove();},300);
        if(onUndo) onUndo();
    });
    requestAnimationFrame(function(){t.classList.add('show');});
    timer=setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove();},300);},5000);
}

// ======================== SAVED PAGE ========================
var _savedOpenFolder=null;
function renderSavedPage(){
    _savedOpenFolder=null;
    var container=document.getElementById('savedContent');
    if(!savedFolders.length||savedFolders.every(function(f){return f.posts.length===0;})){
        // Show empty + folders
        var h='';
        if(savedFolders.length){
            h+='<div class="shop-section-title"><i class="fas fa-folder"></i> Your Folders</div>';
            h+='<div class="shop-scroll-row scroll-2row">';
            savedFolders.forEach(function(f){h+=savedFolderCard(f);});
            h+='</div>';
        }
        h+='<div class="card" style="padding:40px;text-align:center;color:var(--gray);margin-top:20px;"><i class="fas fa-bookmark" style="font-size:36px;margin-bottom:12px;display:block;"></i><p>No saved posts yet.</p><p style="font-size:13px;margin-top:6px;">Use the <i class="fas fa-ellipsis-h"></i> menu on any post to save it.</p></div>';
        container.innerHTML=h;
    } else {
        var h='<div class="shop-section-title"><i class="fas fa-folder"></i> Your Folders</div>';
        h+='<div class="shop-scroll-row scroll-2row">';
        savedFolders.forEach(function(f){h+=savedFolderCard(f);});
        h+='</div>';
        // Show all saved posts
        h+='<div class="shop-section-title" style="margin-top:12px;"><i class="fas fa-bookmark"></i> All Saved Posts</div>';
        var allIds=[];
        savedFolders.forEach(function(f){f.posts.forEach(function(pid){if(allIds.indexOf(pid)===-1)allIds.push(pid);});});
        allIds.forEach(function(pid){
            var p=feedPosts.find(function(fp){return String(fp.idx)===pid;});
            if(p) h+=renderSavedPostCard(p);
        });
        if(!allIds.length) h+='<p style="color:var(--gray);padding:20px;">No posts saved yet.</p>';
        container.innerHTML=h;
    }
    initDragScroll('#savedContent');
    bindSavedPageEvents();
}
function savedFolderCard(f){
    var count=f.posts.length;
    return '<div class="card saved-folder-card" data-fid="'+f.id+'" style="min-width:220px;max-width:220px;flex-shrink:0;scroll-snap-align:start;cursor:pointer;overflow:hidden;">'
        +'<div style="height:80px;background:linear-gradient(135deg,var(--primary),#8b5cf6);display:flex;align-items:center;justify-content:center;"><i class="fas fa-folder-open" style="font-size:32px;color:rgba(255,255,255,.8);"></i></div>'
        +'<div style="padding:14px;">'
        +'<h4 style="font-size:14px;font-weight:600;margin-bottom:4px;">'+f.name+'</h4>'
        +'<p style="font-size:12px;color:var(--gray);">'+count+' post'+(count!==1?'s':'')+'</p>'
        +'<div style="display:flex;gap:6px;margin-top:8px;">'
        +'<button class="btn btn-outline saved-folder-rename" data-fid="'+f.id+'" style="padding:4px 10px;font-size:11px;border-radius:6px;"><i class="fas fa-pen"></i></button>'
        +(f.id!=='fav'?'<button class="btn btn-outline saved-folder-delete" data-fid="'+f.id+'" style="padding:4px 10px;font-size:11px;border-radius:6px;color:#e74c3c;border-color:#e74c3c;"><i class="fas fa-trash"></i></button>':'')
        +'</div></div></div>';
}
function renderSavedPostCard(p){
    var i=p.idx,person=p.person,text=p.text,badge=p.badge,loc=p.loc,likes=p.likes,genComments=p.comments,shares=p.shares;
    var short=text.substring(0,Math.min(160,text.length));var rest=text.substring(160);var hasMore=rest.length>0;
    var folder=findPostFolder(i);
    var html='<div class="card feed-post saved-post-item" data-spid="'+i+'">';
    html+='<div class="post-header">';
    html+='<img src="'+(person.img||person.avatar_url||DEFAULT_AVATAR)+'" alt="'+person.name+'" class="post-avatar" style="object-fit:cover;">';
    html+='<div class="post-user-info"><div class="post-user-top"><h4 class="post-username">'+person.name+'</h4><span class="post-time">'+timeAgo(i)+'</span></div>';
    html+='<div class="post-badges"><span class="badge '+badge.cls+'"><i class="fas '+badge.icon+'"></i> '+badge.text+'</span>';
    if(folder) html+='<span class="badge badge-blue"><i class="fas fa-folder"></i> '+folder.name+'</span>';
    html+='</div></div>';
    html+='<button class="btn btn-outline saved-unsave-btn" data-pid="'+i+'" style="padding:4px 12px;font-size:12px;margin-left:auto;"><i class="fas fa-bookmark-slash"></i> Unsave</button>';
    html+='</div>';
    html+='<div class="post-description"><p>'+short+(hasMore?'<span class="view-more-text hidden">'+rest+'</span>':'')+'</p>'+(hasMore?'<button class="view-more-btn">view more</button>':'')+'</div>';
    if(p.images){var imgs=p.images;html+='<div class="post-media-grid pm-count-'+imgs.length+'">';imgs.forEach(function(src){html+='<div class="pm-thumb"><img src="'+src+'" alt="Post photo"></div>';});html+='</div>';}
    html+='<div class="post-actions"><div class="action-left">';
    html+='<button class="action-btn like-btn" data-post-id="'+i+'"><i class="'+(state.likedPosts[i]?'fas':'far')+' fa-thumbs-up"></i><span class="like-count">'+likes+'</span></button>';
    html+='<button class="action-btn comment-btn"><i class="far fa-comment"></i><span>'+genComments.length+'</span></button>';
    html+='<button class="action-btn share-btn"><i class="fas fa-share-from-square"></i><span>'+shares+'</span></button>';
    html+='</div></div>';
    html+='</div>';
    return html;
}
function renderSavedFolderView(fid){
    _savedOpenFolder=fid;
    var f=savedFolders.find(function(x){return x.id===fid;});
    if(!f) return renderSavedPage();
    var container=document.getElementById('savedContent');
    var h='<a href="#" class="saved-back-link" style="display:inline-flex;align-items:center;gap:6px;color:var(--primary);font-weight:500;font-size:14px;margin-bottom:16px;"><i class="fas fa-arrow-left"></i> Back to Saved</a>';
    h+='<div class="shop-section-title"><i class="fas fa-folder-open"></i> '+f.name+' <span style="font-weight:400;font-size:14px;color:var(--gray);">('+f.posts.length+')</span></div>';
    if(!f.posts.length){
        h+='<div class="card" style="padding:40px;text-align:center;color:var(--gray);"><p>This folder is empty.</p></div>';
    } else {
        f.posts.forEach(function(pid){
            var p=feedPosts.find(function(fp){return String(fp.idx)===pid;});
            if(p) h+=renderSavedPostCard(p);
        });
    }
    container.innerHTML=h;
    bindSavedPageEvents();
}
function bindSavedPageEvents(){
    var c=document.getElementById('savedContent');
    // Folder click
    c.querySelectorAll('.saved-folder-card').forEach(function(card){
        card.addEventListener('click',function(e){
            if(e.target.closest('.saved-folder-rename')||e.target.closest('.saved-folder-delete')) return;
            renderSavedFolderView(card.dataset.fid);
        });
    });
    // Rename
    c.querySelectorAll('.saved-folder-rename').forEach(function(btn){
        btn.addEventListener('click',function(e){
            e.stopPropagation();
            var f=savedFolders.find(function(x){return x.id===btn.dataset.fid;});
            if(!f) return;
            var h='<div class="modal-header"><h3>Rename Folder</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
            h+='<div class="modal-body"><input type="text" id="renameFolderInput" value="'+f.name+'" style="width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:8px;font-size:14px;margin-bottom:12px;"><button class="btn btn-primary" id="renameFolderConfirm" style="width:100%;">Rename</button></div>';
            showModal(h);
            document.getElementById('renameFolderInput').focus();
            document.getElementById('renameFolderConfirm').addEventListener('click',function(){
                var n=document.getElementById('renameFolderInput').value.trim();
                if(n){f.name=n;persistSaved();closeModal();if(_savedOpenFolder)renderSavedFolderView(_savedOpenFolder);else renderSavedPage();}
            });
        });
    });
    // Delete
    c.querySelectorAll('.saved-folder-delete').forEach(function(btn){
        btn.addEventListener('click',function(e){
            e.stopPropagation();
            var f=savedFolders.find(function(x){return x.id===btn.dataset.fid;});
            if(!f) return;
            var h='<div class="modal-header"><h3>Delete Folder</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
            h+='<div class="modal-body"><p style="color:var(--gray);margin-bottom:16px;">Delete "<strong>'+f.name+'</strong>"? Saved post references will be removed.</p><div class="modal-actions"><button class="btn btn-primary modal-close">Cancel</button><button class="btn btn-outline" id="deleteFolderConfirm" style="color:#e74c3c;border-color:#e74c3c;">Delete</button></div></div>';
            showModal(h);
            document.getElementById('deleteFolderConfirm').addEventListener('click',function(){
                savedFolders=savedFolders.filter(function(x){return x.id!==f.id;});
                persistSaved();closeModal();renderSavedPage();
            });
        });
    });
    // Unsave
    c.querySelectorAll('.saved-unsave-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            var pid=btn.dataset.pid;
            savedFolders.forEach(function(f){var idx=f.posts.indexOf(String(pid));if(idx!==-1)f.posts.splice(idx,1);});
            persistSaved();
            if(_savedOpenFolder) renderSavedFolderView(_savedOpenFolder);
            else renderSavedPage();
            showToast('Post unsaved');
        });
    });
    // Back link
    var back=c.querySelector('.saved-back-link');
    if(back) back.addEventListener('click',function(e){e.preventDefault();renderSavedPage();});
    // View more
    c.querySelectorAll('.view-more-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            var span=btn.parentElement.querySelector('.view-more-text');
            if(span.classList.contains('hidden')){span.classList.remove('hidden');btn.textContent='view less';}
            else{span.classList.add('hidden');btn.textContent='view more';}
        });
    });
}
// Create folder button on page
document.getElementById('createFolderBtn').addEventListener('click',function(){
    var h='<div class="modal-header"><h3>Create Folder</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>';
    h+='<div class="modal-body"><input type="text" id="newFolderNameInput" placeholder="Folder name..." style="width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:8px;font-size:14px;margin-bottom:12px;"><button class="btn btn-primary" id="newFolderCreateConfirm" style="width:100%;">Create</button></div>';
    showModal(h);
    document.getElementById('newFolderNameInput').focus();
    document.getElementById('newFolderCreateConfirm').addEventListener('click',function(){
        var n=document.getElementById('newFolderNameInput').value.trim();
        if(!n) return;
        savedFolders.push({id:'folder-'+Date.now(),name:n,posts:[]});
        persistSaved();closeModal();renderSavedPage();
        showToast('Folder "'+n+'" created');
    });
});

// ======================== DRAG-TO-SCROLL ========================
function initDragScroll(container){
    $$(container+' .shop-scroll-row').forEach(function(row){
        var isDown=false,startX,scrollL,moved,velX=0,lastX=0,lastT=0,raf;
        function coast(){velX*=0.92;if(Math.abs(velX)>0.3){row.scrollLeft-=velX;raf=requestAnimationFrame(coast);}else{row.classList.remove('dragging');}};
        row.addEventListener('mousedown',function(e){isDown=true;moved=false;cancelAnimationFrame(raf);row.classList.remove('dragging');startX=e.pageX-row.offsetLeft;scrollL=row.scrollLeft;lastX=e.pageX;lastT=Date.now();velX=0;});
        row.addEventListener('mouseleave',function(){isDown=false;if(moved){coast();}else{row.classList.remove('dragging');}});
        row.addEventListener('mouseup',function(){isDown=false;if(moved){coast();}else{row.classList.remove('dragging');}});
        row.addEventListener('mousemove',function(e){if(!isDown)return;var dx=Math.abs(e.pageX-row.offsetLeft-startX);if(dx>5){moved=true;row.classList.add('dragging');}if(!moved)return;e.preventDefault();var now=Date.now(),dt=now-lastT||1;velX=0.8*velX+0.2*((e.pageX-lastX)/dt*16);lastX=e.pageX;lastT=now;row.scrollLeft=scrollL-(e.pageX-row.offsetLeft-startX);});
        row.addEventListener('click',function(e){if(moved){e.preventDefault();e.stopPropagation();moved=false;}},true);
    });
}

// ======================== INITIALIZE ========================
if(!state.activeTemplate){applyTemplate('spotlight',true);state.activeTemplate='spotlight';}
// generatePosts() is called in initApp() after auth — don't call here to avoid race condition
renderSuggestions();
renderTrendingSidebar();
renderGroups();
renderProfiles();
renderShop();
renderMySkins();
renderMsgContacts();
renderNotifications();
renderPhotosCard();
updateCoins();
updateFollowCounts();

// ======================== LIGHTBOX ========================
(function(){
    var overlay=document.createElement('div');overlay.className='lightbox-overlay';
    overlay.innerHTML='<button class="lightbox-close"><i class="fas fa-times"></i></button><button class="lightbox-arrow lightbox-prev"><i class="fas fa-chevron-left"></i></button><img src="" alt=""><button class="lightbox-arrow lightbox-next"><i class="fas fa-chevron-right"></i></button><div class="lightbox-counter"></div>';
    document.body.appendChild(overlay);
    var img=overlay.querySelector('img'),prev=overlay.querySelector('.lightbox-prev'),next=overlay.querySelector('.lightbox-next'),counter=overlay.querySelector('.lightbox-counter');
    var srcs=[],idx=0,tx=0,dragging=false;

    function open(list,i){srcs=list;idx=i;show();}
    window._openLightbox=open;
    function show(){img.src=srcs[idx];counter.textContent=(idx+1)+' / '+srcs.length;prev.style.display=srcs.length>1?'':'none';next.style.display=srcs.length>1?'':'none';overlay.classList.add('show');document.body.style.overflow='hidden';}
    function close(){overlay.classList.remove('show');document.body.style.overflow='';}
    function go(d){idx=(idx+d+srcs.length)%srcs.length;show();}

    prev.addEventListener('click',function(){go(-1);});
    next.addEventListener('click',function(){go(1);});
    overlay.querySelector('.lightbox-close').addEventListener('click',close);
    overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
    document.addEventListener('keydown',function(e){if(!overlay.classList.contains('show'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')go(-1);if(e.key==='ArrowRight')go(1);});

    // Touch swipe
    overlay.addEventListener('touchstart',function(e){tx=e.touches[0].clientX;dragging=true;},{passive:true});
    overlay.addEventListener('touchend',function(e){if(!dragging)return;dragging=false;var dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>50){dx>0?go(-1):go(1);}});

    // Collect image srcs from a container
    function collect(container){return Array.from(container.querySelectorAll('img')).map(function(i){return i.src;}).filter(Boolean);}

    // Delegate clicks on images in posts, albums, previews
    document.addEventListener('click',function(e){
        var t=e.target;if(t.tagName!=='IMG')return;
        // Post media grid
        var grid=t.closest('.post-media-grid');
        if(grid){var pgid=grid.dataset.pgid;var allMedia=pgid&&window['_media_'+pgid];var list;if(allMedia){list=allMedia.filter(function(m){return m.type==='image';}).map(function(m){return m.src;});}else{list=collect(grid);}if(list.length){open(list,list.indexOf(t.src));e.stopPropagation();return;}}
        // Photo album grid
        var album=t.closest('.photo-album-grid');
        if(album){var list=collect(album);if(list.length){open(list,list.indexOf(t.src));e.stopPropagation();return;}}
        // Photos preview sidebar
        var preview=t.closest('.photos-preview');
        if(preview){var list=collect(preview);if(list.length){open(list,list.indexOf(t.src));e.stopPropagation();return;}}
        // All media modal grid
        var am=t.closest('.all-media-grid');
        if(am){var list=collect(am);if(list.length){open(list,list.indexOf(t.src));e.stopPropagation();return;}}
    });
})();

});
